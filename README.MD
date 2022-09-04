# CurseForge Modpack Downloader
![](img/2.png)
## Download your favourite modpacks without Twitch app!

For some reasons you don't want to download this Twitch application to get some modpacks. Maybe like me you hate it. Maybe like me you must retry several times before Twitch app will download your modpack.  
Worry no more, because here you got
## **CURSEFORGE MODPACK DOWLOADER, HELL YEA**
> Warning: If you are so afraid of cmd, better go away from here. Here you got something with [GUI written in Java](https://github.com/Vazkii/CMPDL), I don't know how it works, use at your own responsibility. Maybe I will add some GUI to this project later

## Usage
### Using Project ID
Find the project ID on the modpack's CurseForge page.

![](img/3.png)

Open your terminal/cmd, enter the directory where you want to download modpack and type `cmpdl <project id>`

For example, [Project Ozone Lite (https://www.curseforge.com/minecraft/modpacks/project-ozone-lite)](https://www.curseforge.com/minecraft/modpacks/project-ozone-lite)
```bash
    cmpdl 273726
```

### Using Project Name/Slug
Or you can try using the project name taken from modpack url, but this method is slower and not always successful. 

![](img/1.png)  

Now just open your terminal/cmd, enter the directory where you want to download modpack and type `cmpdl <project name>`

For example, [Project Ozone Lite (https://www.curseforge.com/minecraft/modpacks/project-ozone-lite)](https://www.curseforge.com/minecraft/modpacks/project-ozone-lite)
```bash
    cmpdl project-ozone-light
```

### Using Project and File ID
To download a version other than the latest file in the project, find the file ID at the end of  the URL to the download page, and type `cmpdl <project id> <file id>`

## Installation
- Install node with npm for your operating system from [nodejs.org](https://nodejs.org/en/)
- Install globally in node with this command:
```bash
    npm install -g curse-modpack-downloader
```
- Run the command `cmpdl`
- Edit the `curse-api-config.json` adding your CurseForge API key.

## License
MIT