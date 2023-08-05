const SnapSvg = () => {
  let Snap;
  try {
    Snap = require("snapsvg-cjs");
  } finally {
    return Snap;
  }
};
export default SnapSvg;
