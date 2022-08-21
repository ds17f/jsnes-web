const getBaseName = () => {
  const url = window.location.href;
  // we're on github pages, which means we have a subpath
  if (url.includes("github.io")) {
    const parts = url.split("/");
    // ["https:/","/","...github.io/",$money]
    return `/${parts[3]}`;
  }

  // default case, we don't have a base path
  // good for localhost
  return "";
};

const config = {
  ROMS: {
    demo: {
      name: "Demo Rom for this Repository",
      description: "A Demo of the rom in this repo",
      url: `${getBaseName()}/roms/demo.nes`
    }
  },
  GOOGLE_ANALYTICS_CODE: process.env.REACT_APP_GOOGLE_ANALYTICS_CODE,
  SENTRY_URI: process.env.REACT_APP_SENTRY_URI,
  BASENAME: getBaseName
};

export default config;
