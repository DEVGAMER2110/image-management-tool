// Global variables
let imageFiles = [];
let excelData = [];
let excelHeaders = [];
let imageGroups = {};
let processedData = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    resetApplication();
});

function resetApplication() {
    // Clear all data when application starts
    imageFiles = [];
    excelData = [];
    excelHeaders = [];
    imageGroups = {};
    processedData = {};

    // Hide sections
    document.getElementById('column-selection').style.display = 'none';
    document.getElementById('image-groups').innerHTML = '';
    document.getElementById('download-section').style.display = 'none';
}

function setupEventListeners() {
    // Image upload listeners
    const imageDropZone = document.getElementById('image-drop-zone');
    const imageUpload = document.getElementById('image-upload');

    // Excel upload listeners
    const excelDropZone = document.getElementById('excel-drop-zone');
    const excelUpload = document.getElementById('excel-upload');

    // Process button listener
    document.getElementById('process-files').addEventListener('click', processFiles);

    // Download buttons
    document.getElementById('download-images').addEventListener('click', downloadImages);
    document.getElementById('download-excel').addEventListener('click', downloadExcel);

    // Drag and drop for images
    setupDragAndDrop(imageDropZone, imageUpload, handleImageFiles);

    // Drag and drop for excel
    setupDragAndDrop(excelDropZone, excelUpload, handleExcelFile);

    // Click to upload
    imageDropZone.addEventListener('click', () => imageUpload.click());
    excelDropZone.addEventListener('click', () => excelUpload.click());

    // File input change events
    imageUpload.addEventListener('change', (e) => handleImageFiles(e.target.files));
    excelUpload.addEventListener('change', (e) => handleExcelFile(e.target.files));
}

function setupDragAndDrop(dropZone, fileInput, handler) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handler(e.dataTransfer.files);
    });
}

function handleImageFiles(files) {
    imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
        alert('No image files found!');
        return;
    }

    document.getElementById('image-drop-zone').innerHTML = 
        `<p>✅ ${imageFiles.length} images loaded</p>`;

    checkIfReadyToProcess();
}

function handleExcelFile(files) {
    if (files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('Excel file must have at least a header row and one data row');
                return;
            }

            excelHeaders = jsonData[0];
            excelData = jsonData.slice(1);

            setupColumnSelection();

            document.getElementById('excel-drop-zone').innerHTML = 
                `<p>✅ Excel file loaded (${excelData.length} rows)</p>`;

            checkIfReadyToProcess();

        } catch (error) {
            alert('Error reading Excel file: ' + error.message);
        }
    };

    reader.readAsBinaryString(file);
}

function setupColumnSelection() {
    const imageNameSelect = document.getElementById('image-name-column');
    const styleCodeSelect = document.getElementById('style-code-column');

    // Clear existing options
    imageNameSelect.innerHTML = '';
    styleCodeSelect.innerHTML = '';

    // Add options
    excelHeaders.forEach((header, index) => {
        const option1 = new Option(header, index);
        const option2 = new Option(header, index);
        imageNameSelect.add(option1);
        styleCodeSelect.add(option2);
    });

    // Try to auto-select based on common names
    autoSelectColumns(imageNameSelect, styleCodeSelect);

    document.getElementById('column-selection').style.display = 'block';
}

function autoSelectColumns(imageNameSelect, styleCodeSelect) {
    // Auto-select common column names
    const imageNamePatterns = ['image', 'img', 'name', 'filename'];
    const styleCodePatterns = ['style', 'code', 'sku', 'product'];

    excelHeaders.forEach((header, index) => {
        const headerLower = header.toLowerCase();

        if (imageNamePatterns.some(pattern => headerLower.includes(pattern))) {
            imageNameSelect.selectedIndex = index;
        }

        if (styleCodePatterns.some(pattern => headerLower.includes(pattern))) {
            styleCodeSelect.selectedIndex = index;
        }
    });
}

function checkIfReadyToProcess() {
    const processButton = document.getElementById('process-files');
    if (imageFiles.length > 0 && excelData.length > 0) {
        processButton.style.display = 'block';
    }
}

function processFiles() {
    const imageNameColumnIndex = parseInt(document.getElementById('image-name-column').value);
    const styleCodeColumnIndex = parseInt(document.getElementById('style-code-column').value);

    // Create lookup map from excel data
    const excelLookup = {};
    excelData.forEach(row => {
        const imageName = row[imageNameColumnIndex];
        const styleCode = row[styleCodeColumnIndex];
        if (imageName && styleCode) {
            excelLookup[imageName] = styleCode;
        }
    });

    // Group images by family (everything before the last underscore and number)
    imageGroups = {};

    imageFiles.forEach(file => {
        const fileName = file.name;
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));

        // Extract family name (everything before _1, _2, etc.)
        const familyMatch = nameWithoutExt.match(/^(.+)_\d+$/);
        const familyName = familyMatch ? familyMatch[1] : nameWithoutExt;

        if (!imageGroups[familyName]) {
            imageGroups[familyName] = {
                images: [],
                styleCode: excelLookup[fileName] || 'Unknown',
                comment: ''
            };
        }

        imageGroups[familyName].images.push({
            file: file,
            originalName: fileName,
            currentName: fileName
        });
    });

    displayImageGroups();
    document.getElementById('download-section').style.display = 'block';
}

function displayImageGroups() {
    const container = document.getElementById('image-groups');
    container.innerHTML = '';

    Object.keys(imageGroups).forEach(familyName => {
        const group = imageGroups[familyName];
        const groupElement = createGroupElement(familyName, group);
        container.appendChild(groupElement);
    });
}

function createGroupElement(familyName, group) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'image-group';

    groupDiv.innerHTML = `
        <div class="group-header">
            <div class="group-title">${familyName}</div>
            <div class="style-code">${group.styleCode}</div>
        </div>
        <div class="comment-section">
            <textarea 
                class="comment-input" 
                placeholder="Add comments for this group..."
                onchange="updateGroupComment('${familyName}', this.value)"
            >${group.comment}</textarea>
        </div>
        <div class="images-grid" id="grid-${familyName}">
        </div>
    `;

    const imagesGrid = groupDiv.querySelector('.images-grid');

    group.images.forEach((imageData, index) => {
        const imageElement = createImageElement(familyName, imageData, index);
        imagesGrid.appendChild(imageElement);
    });

    return groupDiv;
}

function createImageElement(familyName, imageData, index) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'image-item';
    
    // Extract number suffix from filename
    const nameWithoutExt = imageData.originalName.substring(0, imageData.originalName.lastIndexOf('.'));
    const numberMatch = nameWithoutExt.match(/_(\d+)$/);
    const currentNumber = numberMatch ? numberMatch[1] : '1';
    
    // Create the image URL
    const imageUrl = URL.createObjectURL(imageData.file);
    
    imageDiv.innerHTML = `
        <div class="image-container">
            <img class="image-preview" src="${imageUrl}" alt="Image ${currentNumber}">
        </div>
        <div class="image-info">
            <input 
                type="text" 
                class="image-name-input" 
                value="${currentNumber}"
                onchange="updateImageName('${familyName}', ${index}, this.value)"
                placeholder="Image number"
            >
            <button 
                class="delete-btn" 
                onclick="deleteImage('${familyName}', ${index})"
            >Delete</button>
        </div>
    `;
    
    return imageDiv;
}

function updateGroupComment(familyName, comment) {
    if (imageGroups[familyName]) {
        imageGroups[familyName].comment = comment;
    }
}

function updateImageName(familyName, index, newNumber) {
    if (imageGroups[familyName] && imageGroups[familyName].images[index]) {
        const imageData = imageGroups[familyName].images[index];
        const originalName = imageData.originalName;
        
        // Get file extension
        const extension = originalName.substring(originalName.lastIndexOf('.'));
        
        // Get base name (everything before the last _number)
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
        const baseNameMatch = nameWithoutExt.match(/^(.+)_\d+$/);
        const baseName = baseNameMatch ? baseNameMatch[1] : nameWithoutExt;
        
        // Construct new filename
        const newFileName = `${baseName}_${newNumber}${extension}`;
        
        // Update the current name
        imageGroups[familyName].images[index].currentName = newFileName;
    }
}

function deleteImage(familyName, index) {
    if (imageGroups[familyName] && imageGroups[familyName].images[index]) {
        imageGroups[familyName].images.splice(index, 1);

        // Remove group if no images left
        if (imageGroups[familyName].images.length === 0) {
            delete imageGroups[familyName];
        }

        displayImageGroups();
    }
}

async function downloadImages() {
    if (Object.keys(imageGroups).length === 0) {
        alert('No images to download!');
        return;
    }

    const zip = new JSZip();

    // Add images to zip with their current names
   for (const familyName of Object.keys(imageGroups)) {
  const group = imageGroups[familyName];
  for (const imageData of group.images) {
    // add all files at root of the zip
    zip.file(imageData.currentName, imageData.file);
  }
}


    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'renamed_images.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error creating ZIP file: ' + error.message);
    }
}

function downloadExcel() {
    if (excelData.length === 0) {
        alert('No Excel data to download!');
        return;
    }

    // Create new Excel data with comments
    const newHeaders = [...excelHeaders, 'Comments'];
    const newData = [];

    // Add original data with comments
    excelData.forEach(row => {
        const imageName = row[parseInt(document.getElementById('image-name-column').value)];
        let comment = '';

        // Find which group this image belongs to
        for (const familyName of Object.keys(imageGroups)) {
            const group = imageGroups[familyName];
            const hasImage = group.images.some(img => 
                img.originalName === imageName || img.currentName === imageName
            );

            if (hasImage) {
                comment = group.comment || '';
                break;
            }
        }

        newData.push([...row, comment]);
    });

    // Create workbook
    const worksheet = XLSX.utils.aoa_to_sheet([newHeaders, ...newData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Updated Data');

    // Download file
    XLSX.writeFile(workbook, 'updated_excel_with_comments.xlsx');
}

// Utility function to get file extension
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

// Utility function to remove file extension
function removeFileExtension(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}