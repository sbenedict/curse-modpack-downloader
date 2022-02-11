const got = require("got");

class CurseApiClient {

    constructor() {
        this.BASE_URL = "https://addons-ecs.forgesvc.net/api/v2";
        // unofficial CurseForge API docs: https://curseforgeapi.docs.apiary.io/
    
        this.cache = new Map();
    }

    /**
     * 
     * @param {string} projectTitle project title
     * @returns { Promise<project> } project
     */
    async getProjectByTitle(projectTitle) {
        const maxIndex = 10000;
        const pageSize = 20;
        const searchUrl = `${this.BASE_URL}/addon/search`;
        const searchParams = {
            gameId: 432,
            categoryId: 0,
            sectionId: 4471,
            searchFilter: projectTitle,
            pageSize: pageSize,
            index: 0,
            sort: 1,
            sortDescending: true,
        };
        projectTitle = projectTitle.toLowerCase();
        let results = [null];
        let index = 0;
        while (results.length && index < maxIndex) {
            try {
                searchParams.index = index;
                results = await got(searchUrl, { searchParams: searchParams, cache: this.cache }).json();
            } catch (err) {
                console.error(err);
                process.exit(1);
            }
            let project = results.filter(x => x.name.toLowerCase().startsWith(projectTitle));
            if (project.length) return project[0];
            index += pageSize;
        }
        return null;
    }

    /**
     * 
     * @param {string} projectId project ID
     * @returns { Promise<project> } project
     */
    async getProjectById(projectId) {
        try {
            return await got(`${this.BASE_URL}/addon/${projectId}`, { cache: this.cache }).json();
        } catch (err) {
            if (err.constructor === got.HTTPError && err.response.statusCode === 404) {
                return null;
            }
            console.error(err);
            process.exit(1);
        }
    }

    /**
     * 
     * @param {string} projectId project ID
     * @returns { Promise<{ id: number, fileName: string, downloadUrl: string }[]> } array of files
     */
    async getProjectFiles(projectId) {
        try {
            return await got(`${this.BASE_URL}/addon/${projectId}/files`, { cache: this.cache }).json();
        } catch (err) {
            if (err.constructor === got.HTTPError && err.response.statusCode === 404) {
                return null;
            }
            console.error(err);
            process.exit(1);
        }
    }

    /**
     * 
     * @param {string} projectId project ID
     * @param {string} fileId file ID
     * @returns { Promise<fileMeta> } cached file metadata from https://cursemeta.dries007.net/
     */
    async getCachedProjectFile(projectId, fileId) {
        try {
            return await got(`https://cursemeta.dries007.net/${projectId}/${fileId}.json`, { cache: this.cache }).json();
        } catch (err) {
            if (err.constructor === got.HTTPError && err.response.statusCode === 404) {
                return null;
            }
            console.error(err);
            process.exit(1);
        }
    }

    /**
     * 
     * @param {string} projectId project ID
     * @param {string} fileId file ID
     * @returns { Promise<addonFileMeta> } addon file metadata from CurseForge API
     */
    async getAddonFile(projectId, fileId) {
        try {
            return await got(`${this.BASE_URL}/addon/${projectId}/file/${fileId}`, { cache: this.cache }).json();
        } catch (err) {
            if (err.constructor === got.HTTPError && err.response.statusCode === 404) {
                return null;
            }
            console.error(err);
            process.exit(1);
        }
    }

}

module.exports = new CurseApiClient();
