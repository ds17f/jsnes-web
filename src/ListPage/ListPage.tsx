import React, {
  Component,
  ComponentProps,
  ComponentType,
  DragEventHandler,
  Key
} from "react";
import "./ListPage.css";
import { ListGroup } from "reactstrap";
import { Link, NavigateFunction, useNavigate } from "react-router-dom";
import { config } from "../config";
import { getLogger } from "../utils";

import { RomLibrary, RomInfo } from "../RomLibrary";
import { LOCAL_ROM_FLAG } from "../RunPage";

const LOGGER = getLogger("ListPage");

const rootRunPath = "/run";
const rootRunPathLocal = `${rootRunPath}/${LOCAL_ROM_FLAG}`;

interface ListPageProps {
  navigate: NavigateFunction;
}
interface ListPageState {
  romLibrary: RomInfo[];
}

class ListPage extends Component<ListPageProps, ListPageState> {
  constructor(props: ListPageProps) {
    super(props);
    this.state = {
      romLibrary: RomLibrary.load()
    };
  }
  render() {
    return (
      <div
        className="drop-zone"
        onDragOver={this.handleDragOver}
        onDrop={this.handleDrop}
      >
        <div className="container ListPage py-4">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <header className="mb-4">
                <h1 className="mb-3">JSNES</h1>
                <p>
                  A JavaScript NES emulator.{" "}
                  <a href="https://github.com/bfirsh/jsnes">
                    Source on GitHub.
                  </a>
                </p>
              </header>

              <ListGroup className="mb-4">
                {Object.keys(config.ROMS)
                  .sort()
                  .map(key => (
                    <Link
                      key={key}
                      to={rootRunPath + "/" + encodeURIComponent(key)}
                      className="list-group-item"
                    >
                      {config.ROMS[key]["name"]}
                      <span className="float-end">&rsaquo;</span>
                    </Link>
                  ))}
              </ListGroup>

              <p>
                Or, drag and drop a ROM file onto the page to play it. (Google
                may help you find them.)
              </p>

              {this.state.romLibrary.length > 0 ? (
                <div>
                  <p>Previously played:</p>

                  <ListGroup className="mb-4">
                    {this.state.romLibrary
                      .sort(
                        (a, b) =>
                          new Date(b.added).getTime() -
                          new Date(a.added).getTime()
                      )
                      .map(rom => (
                        <Link
                          key={rom.hash}
                          to={rootRunPathLocal + rom.hash}
                          className="list-group-item"
                        >
                          {rom.name}
                          <span
                            onClick={e => {
                              e.preventDefault();
                              this.deleteRom(rom.hash);
                            }}
                            className="delete"
                            title="Delete"
                          >
                            &times;
                          </span>
                          <span className="float-end">&rsaquo;</span>
                        </Link>
                      ))}
                  </ListGroup>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  deleteRom = (hash: Key) => {
    LOGGER.info(`Delete rom: ${hash} from library`);
    RomLibrary.delete(hash);
    this.updateLibrary();
  };

  updateLibrary = () => {
    LOGGER.info("Loading rom library");
    this.setState({ romLibrary: RomLibrary.load() });
  };

  handleDragOver: DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    if (!e.dataTransfer) {
      LOGGER.info("No dataTransfer on drag event, can't handleDrag");
      return;
    }
    e.dataTransfer.dropEffect = "copy";
  };

  handleDrop: DragEventHandler<HTMLDivElement> = e => {
    e.preventDefault();
    if (!e.dataTransfer) {
      LOGGER.info("No dataTransfer on drag event, can't make handleDrop");
      return;
    }

    const file = e.dataTransfer.items
      ? e.dataTransfer.items[0].getAsFile()
      : e.dataTransfer.files[0];

    if (!file) {
      LOGGER.info("No file found, can't save file to Library");
      return;
    }

    RomLibrary.save(file).then(rom => {
      this.updateLibrary();
      this.props.navigate(rootRunPathLocal + rom.hash);
    });
  };
}

/**
 * Add reactRouter useNavigate hooke result to the props of a component
 * @param Component
 */
function withNavigate(Component: ComponentType<any>) {
  return (props: ComponentProps<any>) => (
    <Component {...props} navigate={useNavigate()} />
  );
}
// Make a ListPage component that has navigate
const ListPageWithNavigate = withNavigate(ListPage);
// Export the navigate one as ListPage
export { ListPageWithNavigate as ListPage };
