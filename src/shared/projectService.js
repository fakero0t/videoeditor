export class ProjectService {
  constructor() {
    this.currentProjectPath = null;
    this.currentProjectName = null;
  }

  // Serialize entire project
  serializeProject(projectName, timelineData, mediaData, appType = 'clipforge') {
    return {
      version: "2.0",
      appType: appType,
      projectName: projectName,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      timeline: timelineData,
      media: mediaData
    };
  }

  // Save project to disk (without file copying - that's in main process)
  async prepareProjectForSave(projectPath, timelineStore, mediaStore, appType = 'clipforge') {
    // Extract project name from path (remove .cfproj extension)
    const projectName = projectPath.split('/').pop().replace('.cfproj', '');

    // Serialize stores
    const timelineData = timelineStore.serialize();
    const mediaData = mediaStore.serialize();

    // Convert file paths to relative project paths
    const mediaFolder = `${projectName}_media`;
    mediaData.forEach(file => {
      // Extract filename from path
      const fileName = file.originalPath.split('/').pop();
      file.projectPath = `./${mediaFolder}/${fileName}`;

      if (file.thumbnailPath) {
        const thumbName = file.thumbnailPath.split('/').pop();
        file.thumbnailPath = `./${mediaFolder}/.thumbnails/${thumbName}`;
      }
    });

    // Update clip file paths in timeline to match
    timelineData.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const mediaFile = mediaData.find(m => m.id === clip.mediaFileId);
        if (mediaFile) {
          clip.filePath = mediaFile.projectPath;
        }
      });
    });

    // Create project JSON
    const projectData = this.serializeProject(projectName, timelineData, mediaData, appType);

    // Extract file list for copying
    const filesToCopy = mediaData.map(file => ({
      source: file.originalPath,
      destRelative: file.projectPath,
      type: 'media'
    }));

    // Add thumbnails
    mediaData.forEach(file => {
      if (file.thumbnailPath) {
        filesToCopy.push({
          source: file.thumbnailPath.replace(`./${mediaFolder}/.thumbnails/`, ''), // Original path
          destRelative: file.thumbnailPath,
          type: 'thumbnail'
        });
      }
    });

    return {
      projectData,
      filesToCopy
    };
  }

  // Load project from disk
  async loadProject(projectPath, projectData, timelineStore, mediaStore, expectedAppType = 'clipforge') {
    // Validate app type
    if (projectData.appType && projectData.appType !== expectedAppType) {
      throw new Error(`This project was created in ${projectData.appType} and cannot be opened in ${expectedAppType}`);
    }
    // Extract project folder and name from path
    const pathParts = projectPath.split('/');
    const projectName = pathParts.pop().replace('.cfproj', '');
    const projectFolder = pathParts.join('/');
    const mediaFolder = `${projectFolder}/${projectName}_media`;

    // Convert relative paths to absolute paths
    projectData.media.forEach(file => {
      file.projectPath = `${projectFolder}/${file.projectPath}`;
      if (file.thumbnailPath) {
        file.thumbnailPath = `${projectFolder}/${file.thumbnailPath}`;
      }
    });

    // Check for missing media files
    const missingFiles = [];
    for (const file of projectData.media) {
      const exists = await window.electronAPI.fileSystem.fileExists(file.projectPath);
      if (!exists) {
        missingFiles.push(file);
        file.isMissing = true; // Mark as missing
      }
    }

    // Deserialize into stores
    mediaStore.deserialize(projectData.media);
    timelineStore.deserialize(projectData.timeline);

    this.currentProjectPath = projectPath;
    this.currentProjectName = projectName;

    return {
      success: true,
      missingFiles
    };
  }
}
