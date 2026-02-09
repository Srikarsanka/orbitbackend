
function moveFacultyCameraToGrid(facultyUid) {
    if(!facultyUid) return;
    const facultyContainer = document.getElementById(`user-container-${facultyUid}`);
    if(facultyContainer && facultyContainer.parentElement.id === "primary-video-container") {
        console.log("⬇️ Moving Faculty Camera to GRID for Screen Share");
        const grid = document.getElementById("streams_container"); // This is the wrapper inside student-grid-container
        if(grid) grid.insertBefore(facultyContainer, grid.firstChild); // Put at start of grid
    }
}

function restoreFacultyCameraToPrimary(facultyUid) {
    if(!facultyUid) return;
    // Check if screen share is still there? If this called, assume screen share left.
    const facultyContainer = document.getElementById(`user-container-${facultyUid}`);
    const primary = document.getElementById("primary-video-container");
    
    if(facultyContainer && primary) {
         console.log("⬆️ Moving Faculty Camera back to PRIMARY");
         
         // Clear primary first (e.g. remove left-over screen labels if any)
         // But careful not to remove empty state if we want to keep structure.
         // Actually addToContainer handles clearing placeholders.
         
         primary.appendChild(facultyContainer);
         
         // Also update label if we changed it? (Label logic is inside createVideoContainer, 
         // static HTML. Might not need change).
    }
}
