#!/usr/bin/env node
const CurseApi = require('./curse-api');
const downloadFile = require('./download-file');
const fs = require('fs-extra');
const extractZip = require('extract-zip');
const path = require('path');
// unofficial CurseForge API docs: https://curseforgeapi.docs.apiary.io/

function createFolder(path) {
    try {
        fs.mkdirSync(path);
    } catch (err) {
        if (err.code != "EEXIST") {
            console.error(`ERROR: Can't create folder "${path}"! Make sure that program has access to current folder.`);
            process.exit(1);
        }
    }
}

/**
 * 
 * @param {string} projectTitle project title
 * @returns { Promise<string|null> } project id
 */
async function getProjectIdByTitle(projectTitle) {
    const project = await CurseApi.getProjectByTitle(projectTitle);
    if (project === null)
    {
        console.error(`Can't find project with title "${projectTitle}".`);
        process.exit(1);
    }
    return project.id;
}

/**
 * 
 * @param {string} projectSlugOrUrl project slug or complete url
 * @returns { Promise<{ url: string, version: string, fileName: string }> }
 */
async function getLatestProjectFileUrl(projectSlugOrUrl) {
    const project = await CurseApi.getProjectByUrl(projectSlugOrUrl);
    const defaultFile = await getLatestProjectFile(project);
    return {
        url: defaultFile.downloadUrl,
        version: defaultFile.displayName,
        fileName: defaultFile.fileName
    }
}

/**
 * 
 * @param {string} projectId project ID
 * @returns { Promise<{ url: string, version: string, fileName: string }> }
 */
async function getLatestProjectFileUrlById(projectId) {
    const project = await CurseApi.getProjectById(projectId);
    const defaultFile = await getLatestProjectFile(project);
    return {
        url: defaultFile.downloadUrl,
        version: defaultFile.displayName,
        fileName: defaultFile.fileName
    }
}

/**
 * 
 * @param {string} projectId project ID
 * @param {string} fileId file ID
 * @returns { Promise<{ url: string, version: string, fileName: string }> }
 */
async function getProjectFileUrlByFileId(projectId, fileId) {
    const file = await CurseApi.getAddonFile(projectId, fileId);
    return {
        url: file.downloadUrl,
        version: file.displayName,
        fileName: file.fileName
    }
}
/**
 * 
 * @param {string} projectId project ID
 * @param {string} fileId file ID
 * @returns { Promise<file> } file
 */
async function getProjectFile(projectId, fileId) {
    const addonFile = await CurseApi.getAddonFile(projectId, fileId);
    if (addonFile !== null) {
        return addonFile;
    }
    // project's latest files
    const project = await CurseApi.getProjectById(projectId);
    if (project !== null) {
        const file = project.latestFiles.filter(x => x.id == fileId);
        if (file.length) {
            return file[0];
        }
    }
    // all project's files
    const projectFiles = await CurseApi.getProjectFiles(projectId);
    if (projectFiles !== null) {
        const file2 = projectFiles.filter(x => x.id == fileId);
        if (file2.length)
        {
            return file2[0];
        }
    }
    // cached project meta data
    const cachedProjectFile = await CurseApi.getCachedProjectFile(projectId, fileId);
    if (cachedProjectFile !== null)
    {
        return {
            fileName: cachedProjectFile.FileName,
            downloadUrl: cachedProjectFile.DownloadURL,
        };
    }
    console.error(`File ${fileId} not found in project ${projectId}.`);
    process.exit(1);
}

/**
 * 
 * @param { project } project project
 * @returns { Promise<file> } file
 */
async function getLatestProjectFile(project) {
    const file = project.latestFiles
        .filter(x => x.isServerPack === false)
        .sort((a, b) => Date.parse(b.fileDate) - Date.parse(a.fileDate))
        [0]
    return await getProjectFile(file.projectId, file.id);
}

function loadManifest(path) {
    let manifest = fs.readFileSync(path).toString();
    return JSON.parse(manifest);
}

/**
 * 
 * @param { manifest } manifest 
 * @returns { Promise<any> }
 */
async function generateFileListFromManifest(manifest) {
    return Promise.all(manifest.files
    .map(async file => {
        let f = await getProjectFile(file.projectID, file.fileID);
        return {
            name: f.fileName,
            downloadUrl: f.downloadUrl
        };
    }));
}

/**
 * 
 * @param {string} filename 
 * @returns {string}
 */
function removeIllegalCharactersFromFilename(filename) {
    return filename.replace(/[/\\?%*:|"<>]/g, '-');
}

/**
 * 
 * @param {string} path 
 * @returns {boolean}
 */
function fileExists(path) {
    try {
        return fs.statSync(path) !== null;
    } catch (err) {
        if (err.code == "ENOENT") {
            return false;
        }
        throw err;
    }
}

/**
 * 
 * @param { string } src Source path
 * @param { string } dest Destination path
 * @returns { Promise<void> } file
 */
async function moveFolder(src, dest) {
    const files = await fs.readdir(src);
    await Promise.all(
        files.map(f => fs.move(path.join(src, f), path.join(dest, f), { overwrite: true }))
    );
}

/**
 * 
 * @param {string[]} argv 
 */
async function main(argv) {
    if (argv.length < 3) {
        console.error("Usage: cmpdl <project id|project name> <file id>");
        process.exit(1);
    }
    let project = argv[2];
    if (isNaN(parseInt(project, 10))) {
        console.log("Searching for project main file");
        project = await getProjectIdByTitle(project);
    }
    const latest = argv.length < 4 ? await getLatestProjectFileUrlById(project)
        : await getProjectFileUrlByFileId(project, argv[3]);

    createFolder("./modpacks");
    const projectFolderName = removeIllegalCharactersFromFilename(latest.version);
    createFolder('./modpacks/' + projectFolderName);
    const projectFolderPath = path.resolve(`./modpacks/${projectFolderName}`);
    const projectArchivePath = `${projectFolderPath}/${latest.fileName}`

    if (!fileExists(projectArchivePath)) {
        console.log("Downloading project main file:" + latest.version);
        await downloadFile(latest.url, projectArchivePath);
    }

    const projectExtractedPath = path.join(projectFolderPath, 'extracted');
    if (!fileExists(path.join(projectExtractedPath, "manifest.json"))) {
        console.log("Extracting...");
        await extractZip(projectArchivePath, {dir: projectExtractedPath});
        console.log("Extracted");
    }
    
    if (!fileExists(path.join(projectExtractedPath, "manifest.json"))) {
        console.error("Invalid project file. manifest.json not found.");
        process.exit(1);
    }
    const manifest = loadManifest(path.join(projectFolderPath, "extracted", "manifest.json"));

    const dotMinecraft = path.join(projectFolderPath, ".minecraft");
    createFolder(dotMinecraft);
    const modsPath = path.join(dotMinecraft, "mods");
    createFolder(modsPath);
    
    console.log("Generating file list...");
    const fileList = await generateFileListFromManifest(manifest);
    console.log("Generated file list!");
    const total = fileList.length;
    let downloaded = 0;
    console.log(`There's ${total} mods to download...`);
    console.log("Starting downloading mods...");
    
    const maxWidth = `(${total}/${total}) `.length;
    for (let i = 0; i < total; i++) {
        let progress = `(${downloaded + 1}/${total}) `;
        if (progress.length < maxWidth)
            progress = progress + ' '.repeat(maxWidth - progress.length);
        const destFile = path.join(modsPath, fileList[i].name);
        let fileName = fileList[i].name;
        if (fileName.length < 40)
            fileName = fileName + ' '.repeat(40 - fileName.length);
        if (fileExists(destFile) && fs.statSync(destFile).size > 0) {
            console.log(`${progress}${fileName} Already downloaded!`);
        }
        else {
            await downloadFile(fileList[i].downloadUrl, destFile, progress);
        }
        downloaded++;
    }
    console.log("Finished downloading");
    console.log("Finishing job...");
    if (manifest.overrides) {
        const overridesDir = path.join(projectFolderPath, "extracted", manifest.overrides);
        console.log("Copying overrides...");
        await moveFolder(overridesDir, dotMinecraft);
        await fs.rmdir(overridesDir);
        console.log("Copied overrides!");
    }
    console.log("Finished!")
    console.log("")
    console.log(`Now you have to install minecraft ${manifest.minecraft.version}`);
    if (manifest.minecraft.modLoaders) {
        console.log('Then you need to install mod loaders: ');
        manifest.minecraft.modLoaders.forEach(modLoader => console.log(modLoader.id));
    }
    console.log(`After that copy everything from ${dotMinecraft}\nto your downloaded .minecraft and you're ready to go!`);
}
main(process.argv);