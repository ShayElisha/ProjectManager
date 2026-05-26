"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_ROLE_MAX_LEN = void 0;
exports.normalizeProjectRole = normalizeProjectRole;
exports.isValidProjectRole = isValidProjectRole;
exports.PROJECT_ROLE_MAX_LEN = 3;
/** Trim and uppercase; cap at 3 characters. */
function normalizeProjectRole(input) {
    return input.replace(/\s/g, "").toUpperCase().slice(0, exports.PROJECT_ROLE_MAX_LEN);
}
function isValidProjectRole(role) {
    const code = normalizeProjectRole(role);
    return code.length >= 1 && code.length <= exports.PROJECT_ROLE_MAX_LEN;
}
//# sourceMappingURL=project-role.js.map