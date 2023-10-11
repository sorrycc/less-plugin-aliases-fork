const path = require("path");
const fs = require("fs");

function parseOptions(options) {
    return options.split('&').reduce((acc, cur) => {
        const [key, value] = cur.split('=');
        acc[key] = value;
        return acc;
    }, {});
}

const checkExtList = [".less", ".css"];
function normalizePath(filename) {
    if (/\.(?:less|css)$/i.test(filename)) {
        return fs.existsSync(filename) ? filename : undefined;
    }
    for (let i = 0, len = checkExtList.length; i < len; i++) {
        const ext = checkExtList[i];
        if (fs.existsSync(`${filename}${ext}`)) {
            return `${filename}${ext}`;
        }
    }
}

const MODULE_REQUEST_REGEX = /^[^?]*~/;

const defaultLogger = {
    log: console.log,
    error: console.error
};
class LessAliasesPlugin {
    constructor(options) {
        this.options = options;
    }
    setOptions(options) {
        const parsedOptions = parseOptions(options);
        this.options = {
            aliases: parsedOptions,
        };
    }
    install(less, pluginManager) {
        const { prefix = '', aliases, logger = defaultLogger } = this.options;
        function resolve(filename) {
            const chunks = filename.split('/');
            const aliaseKey = chunks[0];
            const restPath = chunks.slice(1).join('/');
            const resolvedAliase = aliases[aliaseKey];
            let resolvedPath = normalizePath(path.join(resolvedAliase, restPath));
            if (!resolvedPath) {
                throw new Error(`Invalid aliase config for key: ${aliaseKey}`);
            }
            return resolvedPath;
        }
        class AliasePlugin extends less.FileManager {
            supports(filename, currentDirectory) {
                const aliaseNames = Object.keys(aliases);
                const len = aliaseNames.length;
                for (let i = 0; i < len; i++) {
                    const key = `${prefix}${aliaseNames[i]}`;
                    if (filename === key || filename.startsWith(`${key}/`)) {
                        return true;
                    }
                }
                return false;
            }
            supportsSync(filename, currentDirectory) {
                return this.supports(filename, currentDirectory);
            }
            loadFile(filename, currentDirectory, options, enviroment, callback) {
                let resolved;
                try {
                    resolved = resolve(filename);
                }
                catch (error) {
                    logger.error(error);
                }
                if (!resolved) {
                    const error = new Error(`[less-plugin-aliases]: '${filename}' not found.`);
                    logger.error(error);
                    throw error;
                }
                return super.loadFile(resolved, currentDirectory, options, enviroment, callback);
            }
            loadFileSync(filename, currentDirectory, options, enviroment, callback) {
                let resolved;
                try {
                    resolved = resolve(filename);
                }
                catch (error) {
                    logger.error(error);
                }
                if (!resolved) {
                    const error = new Error(`[less-plugin-aliases]: '${filename}' not found.`);
                    logger.error(error);
                    throw error;
                }
                return super.loadFileSync(resolved, currentDirectory, options, enviroment, callback);
            }
        }
        pluginManager.addFileManager(new AliasePlugin());

        class StripTildePrefix extends less.FileManager {
            supports(filename, currentDirectory) {
                return true;
            }
            supportsSync(filename, currentDirectory) {
                return true;
            }
            loadFile(filename, currentDirectory, options, enviroment, callback) {
                let resolved = filename.startsWith('~') ? filename.replace(MODULE_REQUEST_REGEX, '') : filename;
                return super.loadFile(resolved, currentDirectory, options, enviroment, callback);
            }
            loadFileSync(filename, currentDirectory, options, enviroment, callback) {
                let resolved = filename.startsWith('~') ? filename.replace(MODULE_REQUEST_REGEX, '') : filename;
                return super.loadFileSync(resolved, currentDirectory, options, enviroment, callback);
            }
        }
        pluginManager.addFileManager(new StripTildePrefix());
    }
}

module.exports = LessAliasesPlugin;
