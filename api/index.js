const mod = require("../server/nest/serverless.js");

module.exports = mod.default ?? mod;
module.exports.config = mod.config ?? { maxDuration: 60, memory: 1024 };
