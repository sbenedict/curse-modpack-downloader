#!/usr/bin/env node
const downloadFile = require('./download-file');
const fs = require('fs-extra');
const { promisify } = require('util');
const extractZip = promisify(require('extract-zip'));
const path = require('path');
const requestPromise = require('request-promise-native');
const BASE_URL = "https://addons-ecs.forgesvc.net/api/v2";

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
    const maxIndex = 10000;
    const searchUrl = `${BASE_URL}/addon/search?gameId=432&categoryId=0&searchFilter=${projectTitle}`
        + `&pageSize=20&index=$index&sort=1&sortDescending=true&sectionId=4471`;
    projectTitle = projectTitle.toLowerCase();
    let results = [null];
    let index = 0;
    while (results.length && index < maxIndex) {
        try {
            let url = searchUrl.replace("$index", index);
            let searchRes = await requestPromise.get(url);
            results = JSON.parse(searchRes);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
        let project = results.filter(x => x.name.toLowerCase().startsWith(projectTitle));
        if (project.length) return project[0].id;
        index += 20;
    }
    console.error(`Can't find project with title "${projectTitle}".`);
    process.exit(1);
}

/**
 * 
 * @param {string} projectId project ID
 * @returns { Promise<project> } project
 */
async function getProjectById(projectId) {
    try {
        const res = await requestPromise.get(`${BASE_URL}/addon/${projectId}`);
        return JSON.parse(res);
    } catch (err) {
        if (err.statusCode == 404) {
            console.error(`Can't find project ${projectId}.`);
        }
        else {
            console.error(err);
        }
        process.exit(1);
    }
}

/**
 * 
 * @param {string} projectId project ID
 * @returns { Promise<{ id: number, fileName: string, downloadUrl: string }[]> } array of files
 */
async function getProjectFiles(projectId) {
    try {
        const res = await requestPromise.get(`${BASE_URL}/addon/${projectId}/files`);
        return JSON.parse(res);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

/**
 * 
 * @param {string} projectSlugOrUrl project slug or complete url
 * @returns { Promise<{ url: string, version: string, fileName: string }> }
 */
async function getLatestProjectFileUrl(projectSlugOrUrl) {
    const project = await getProjectByUrl(projectSlugOrUrl);
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
    const project = await getProjectById(projectId);
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
 * @returns { Promise<file> } file
 */
async function getProjectFile(projectId, fileId) {
    const project = await getProjectById(projectId);
    const file = project.latestFiles.filter(x => x.id == fileId);
    if (file.length) {
        return file[0];
    }
    const projectFiles = await getProjectFiles(projectId);
    const file2 = projectFiles.filter(x => x.id == fileId);
    if (file2.length)
    {
        return file2[0];
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
 * @param {string[]} argv 
 */
async function main(argv) {
    if(argv.length < 3) {
        console.error("Usage: cmpdl <project id|project name>");
        process.exit(1);
    }
    let project = argv[2];
    if (isNaN(parseInt(project, 10))) {
        console.log("Searching for project main file");
        project = await getProjectIdByTitle(project);
    }
    const latest = await getLatestProjectFileUrlById(project);
    createFolder("./modpacks");
    const projectFolderName = removeIllegalCharactersFromFilename(latest.version);
    createFolder('./modpacks/' + projectFolderName);
    const projectFolderPath = path.resolve(`./modpacks/${projectFolderName}`);
    const projectArchivePath = `${projectFolderPath}/${latest.fileName}`

    if (!fileExists(projectArchivePath)) {
        console.log("Downloading project main file v." + latest.version);
        await downloadFile(latest.url, projectArchivePath);

        console.log("Extracting...");
        await extractZip(projectArchivePath, {dir: path.join(projectFolderPath, 'extracted')});
        console.log("Extracted");
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
    
    for(let i = 0; i < total; i++) {
        let progress = `(${downloaded + 1}/${total}) `;
        let maxWidth = `(${total}/${total}) `.length;
        if(progress.length < maxWidth)
            progress = progress + ' '.repeat(maxWidth - progress.length);
        await downloadFile(fileList[i].downloadUrl, path.join(modsPath, fileList[i].name), progress);
        downloaded++;
    }
    console.log("Finished downloading");
    console.log("Finishing job...");
    if(manifest.overrides) {
        const overridesDir = path.join(projectFolderPath, "extracted", manifest.overrides);
        console.log("Copying overrides...");
        fs.copySync(overridesDir, dotMinecraft, { overwrite: true });
        console.log("Copied overrides!");
    }
    console.log("Finished!")
    console.log(`Now you have to install minecraft ${manifest.minecraft.version}`);
    if(manifest.minecraft.modLoaders) {
        console.log('Then you need to install mod loaders: ');
        manifest.minecraft.modLoaders.forEach(modLoader => console.log(modLoader.id));
    }
    console.log(`After that copy everything from ${dotMinecraft}\nto your downloaded .minecraft and you're ready to go!`);
}
main(process.argv);