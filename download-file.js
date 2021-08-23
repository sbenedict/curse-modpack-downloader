const cliProgress = require('cli-progress');
const fs = require("fs-extra");
const path = require("path");
const { promisify } = require("util");
const stream = require('stream');
const got = require('got');

/**
 * Downloads file from given url and saves it to given targetPath
 * @param {string} url file source url
 * @param {string} targetPath path, where file will be saved
 * @param {string} additionalInfo a string that will be displayed before progress bar. It should have fixed size
 */
module.exports = function downloadFile(url, targetPath, additionalInfo = "") {
    return new Promise((resolve, reject) => {
        const tempTargetPath = targetPath + '.downloading';
        fs.removeSync(tempTargetPath);
        /** @type { cliProgress.Bar } */
        let bar = null;
        let filename = path.basename(targetPath);
        // If filename is too long it will short it
        if (filename.length > 40) {
            filename = filename.substring(0, 30) + "..." + filename.substring(filename.length - 7);
        }
        // If filename is too short it will add some padding.
        if (filename.length < 40) {
            filename = filename + ' '.repeat(40 - filename.length);
        }
        /** @type Date */
        let started = null;
        function createBar(total) {
            started = new Date();
            bar = new cliProgress.Bar({
                format: `${additionalInfo}${filename} [{bar}] {percentage}% | {value}KB/{total}KB ({speed} KB/s) {eta}s`,
                barCompleteChar: "#"
            });
            bar.start(total, 0);
        }

        function updateAndGetSpeed(transferred) {
            const elapsedSeconds = (new Date() - started) / 1000;
            const bytesPerSecond = elapsedSeconds <= 0 ? 0 : transferred / elapsedSeconds;
            return bytesPerSecond;
        }

        const pipeline = promisify(stream.pipeline)
        const gotStream = got.stream(url)

        gotStream.on('downloadProgress', progress => {
            if (progress.total) {
                if (!bar) {
                    createBar(Math.floor(progress.total / 1024));
                }
                const speed = updateAndGetSpeed(progress.transferred);
                bar.update(Math.floor(progress.transferred / 1024), { speed: Math.floor(speed / 1024) });
            }
        });

        pipeline(gotStream, fs.createWriteStream(tempTargetPath))
            .then(() => {
                if (!bar) {
                    createBar(1);
                }
                bar.update(bar.getTotal());
                bar.stop();
                fs.renameSync(tempTargetPath, targetPath);
                resolve();
            })
            .catch((reason) => {
                if (bar) bar.stop();
                reject(reason);
            })
    });
}