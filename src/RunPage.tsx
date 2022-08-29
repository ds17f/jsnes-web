import React, {
  Component,
  ComponentProps,
  ComponentType,
  ReactElement
} from "react";
import { Button, Progress } from "reactstrap";
import { Link, Params, useLocation, useParams } from "react-router-dom";

import config, { RomConfig } from "./config";
import ControlsModal from "./ControlsModal";
import Emulator from "./Emulator";
import RomLibrary from "./RomLibrary";
import { loadBinary } from "./utils/utils";
import { getLogger } from "./utils/logging";
import * as ReactRouter from "react-router-dom";

import "./RunPage.css";

const LOGGER = getLogger("RunPage");

export const LOCAL_ROM_FLAG = "local-";

function withParams(Component: ComponentType<any>) {
  return (props: ComponentProps<any>) => (
    <Component {...props} params={useParams()} location={useLocation()} />
  );
}

interface RunPageProps {
  params: Readonly<Params>;
  location: ReactRouter.Location;
}
interface RunPageState {
  romName: ReactElement | string | null;
  romData: string | null; // TODO: Is this really a string?
  running: boolean;
  paused: boolean;
  controlsModalOpen: boolean;
  loading: boolean;
  loadedPercent: number;
  error: string | null;
}

/*
 * The UI for the emulator. Also responsible for loading ROM from URL or file.
 */
class RunPage extends Component<RunPageProps, RunPageState> {
  private emulator?: Emulator | null;
  private navbar?: HTMLElement | null;
  private screenContainer?: HTMLElement | null;
  private currentRequest?: XMLHttpRequest | null;

  constructor(props: RunPageProps) {
    super(props);
    this.state = {
      romName: null,
      romData: null,
      running: false,
      paused: false,
      controlsModalOpen: false,
      loading: true,
      loadedPercent: 3,
      error: null
    };
  }

  render() {
    return (
      <div className="RunPage">
        <nav
          className="navbar navbar-expand"
          ref={el => {
            this.navbar = el;
          }}
        >
          <ul className="navbar-nav" style={{ width: "200px" }}>
            <li className="navitem">
              <Link to="/" className="nav-link">
                &lsaquo; Back
              </Link>
            </li>
          </ul>
          <ul className="navbar-nav ms-auto me-auto">
            <li className="navitem">
              <span className="navbar-text me-3">{this.state.romName}</span>
            </li>
          </ul>
          <ul className="navbar-nav" style={{ width: "200px" }}>
            <li className="navitem">
              <Button
                outline
                color="primary"
                onClick={this.toggleControlsModal}
                className="me-3"
              >
                Controls
              </Button>
              <Button
                outline
                color="primary"
                onClick={this.handlePauseResume}
                disabled={!this.state.running}
              >
                {this.state.paused ? "Resume" : "Pause"}
              </Button>
            </li>
          </ul>
        </nav>

        {this.state.error ? (
          this.state.error
        ) : (
          <div
            className="screen-container"
            ref={el => {
              this.screenContainer = el;
            }}
          >
            {this.state.loading ? (
              <Progress
                value={this.state.loadedPercent}
                style={{
                  position: "absolute",
                  width: "70%",
                  left: "15%",
                  top: "48%"
                }}
              />
            ) : this.state.romData ? (
              <Emulator
                romData={this.state.romData}
                paused={this.state.paused}
                ref={emulator => {
                  this.emulator = emulator;
                }}
              />
            ) : null}

            {/* TODO: lift keyboard and gamepad state up */}
            {this.state.controlsModalOpen && (
              <ControlsModal
                isOpen={this.state.controlsModalOpen}
                toggle={this.toggleControlsModal}
                keys={this.emulator!.keyboardController.keys!}
                setKeys={this.emulator!.keyboardController.setKeys}
                promptButton={this.emulator!.gamepadController.promptButton}
                gamepadConfig={this.emulator!.gamepadController.gamepadConfig!}
                setGamepadConfig={
                  this.emulator!.gamepadController.setGamepadConfig
                }
              />
            )}
          </div>
        )}
      </div>
    );
  }

  componentDidMount() {
    window.addEventListener("resize", this.layout);
    this.layout();
    this.load();
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.layout);
    if (this.currentRequest) {
      this.currentRequest.abort();
    }
  }

  load = () => {
    LOGGER.info("Load rom");
    LOGGER.debug({ params: this.props.params });
    LOGGER.debug({ locationState: this.props.location.state });

    const { slug } = this.props.params;
    // @ts-ignore state is type unknown
    // TODO: When can we have a File in the state?
    const file = this.props.location.state?.file as File;

    if (!slug && !file) {
      LOGGER.info("No slug and no file, so no rom");
      this.setState({ error: "No ROM provided" });
      return;
    }

    if (slug) {
      LOGGER.info("Slug provided, load rom");
      const isLocalROM = new RegExp(`^${LOCAL_ROM_FLAG}`).test(slug);

      if (isLocalROM) {
        this.loadRomFromLocalStorage(slug);
      } else {
        this.loadRomFromURI(config.ROMS[slug]);
      }
      return;
    }

    if (file) {
      LOGGER.info("No slug, but file provided, load rom from file");
      this.loadRomFromFile(file);
      return;
    }
  };

  /**
   * Loads a rom from local storage using the slug to generate a key
   * @param slug expects the slug to be formatted as `local-{hash}`
   */
  loadRomFromLocalStorage = (slug: string) => {
    const romHash = slug.split("-")[1];
    const romInfo = RomLibrary.getRomInfoByHash(romHash);
    if (!romInfo) {
      LOGGER.info("No rom info found for local rom");
      this.setState({ error: `No such ROM: ${slug}` });
      return;
    }

    this.setState({ romName: romInfo.name });
    const localROMData = localStorage.getItem("blob-" + romHash);
    if (!localROMData) {
      LOGGER.info(
        "Failed to load from local storage: Local rom data was empty"
      );
      this.setState({ error: `ROM data in Local Storage is bad: ${slug}` });
      return;
    }
    this.handleLoaded(localROMData);
  };

  /**
   * Loads a rom from URL by using the slug to look up a config value
   * @param romConfig
   */
  loadRomFromURI = (romConfig: RomConfig) => {
    this.setState({ romName: romConfig.description });
    this.currentRequest = loadBinary(
      romConfig.url,
      (err: Error, nesRomString: string) => {
        LOGGER.info({ loadedUriData: nesRomString });
        if (err) {
          this.setState({ error: `Error loading ROM: ${err.message}` });
        } else {
          this.handleLoaded(nesRomString);
        }
      },
      this.handleProgress
    );
  };

  /**
   * Loads a rom from a file object
   * @param file
   */
  loadRomFromFile = (file: File) => {
    let reader = new FileReader();
    reader.readAsBinaryString(file);
    reader.onload = () => {
      this.currentRequest = null;
      this.handleLoaded(reader.result as string);
    };
  };

  handleProgress = (e: ProgressEvent) => {
    if (e.lengthComputable) {
      this.setState({ loadedPercent: (e.loaded / e.total) * 100 });
    }
  };

  handleLoaded = (romData: string) => {
    LOGGER.debug({ romData });
    this.setState({ running: true, loading: false, romData });
  };

  handlePauseResume = () => {
    this.setState({ paused: !this.state.paused });
  };

  layout = () => {
    let navbarHeight = parseFloat(window.getComputedStyle(this.navbar!).height);
    this.screenContainer!.style.height = `${window.innerHeight -
      navbarHeight}px`;
    if (this.emulator) {
      this.emulator.fitInParent();
    }
  };

  toggleControlsModal = () => {
    this.setState({ controlsModalOpen: !this.state.controlsModalOpen });
  };
}

export default withParams(RunPage);
