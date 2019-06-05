/*

TODO:

*/

const { dialog } = require('electron').remote;
const globby = require('globby');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
const os = require('os');

// the json that stores info about the classfication
let classification_info = {};

let fileList = [];
let currentFileIndex;
let currentClassIndex;
const fileListNode = document.querySelector('#fileList');
const classListNode = document.querySelector('#classList');
const image = document.querySelector('#image');
const folderButton = document.querySelector('#selectBtn');
const nextButton = document.querySelector('#next');
const prevButton = document.querySelector('#prev');
const addClass = document.querySelector('#addClass');
const editClass = document.querySelector('#editClass');
const confirmButton = document.querySelector('#confirmButton');
const classContainer = document.querySelector('#classContainer');
const classHeader = document.querySelector('#classHeader');
const removeButton = document.querySelector('#remove');

let containingFolder;
let confirmButtonActive = false;
let isEditingToggled = false;
let isEditingClassName = true;

let slash;
const isWin = process.platform === 'win32';

if (isWin) {
	slash = '\\';
} else {
	slash = '/';
}

// function used to hide buttons when needed
const hideButton = (node, clickHandler) => {
	node.removeEventListener('click', clickHandler);
	node.style.opacity = 0;
	setTimeout(function() {
		node.style.visibility = 'hidden';
	}, 300);
};

//function used to show buttons when needed
const showButton = (node, clickHandler) => {
	node.addEventListener('click', clickHandler);
	node.style.opacity = 1;
	node.style.visibility = 'visible';
};

// loads the next image in the file list
const handleNextButton = function(event) {
	changeIndex(currentFileIndex + 1);
};

// loads the prev image in the file list
const handlePrevButton = function(event) {
	changeIndex(currentFileIndex - 1);
};

const moveImageHandler = (activeClassName, isClass = true) => {
	const activeFilePath = fileList[currentFileIndex];
	const activeFileName = path.parse(activeFilePath).base.replace(' ', '_');
	let newFilePath;
	if (isClass) {
		newFilePath = `${containingFolder}${slash}${activeClassName}-class${slash}${activeFileName}`;
	} else {
		newFilePath = `${containingFolder}${slash}${activeClassName}${slash}${activeFileName}`;
	}

	fs.rename(activeFilePath, newFilePath, function(err) {
		if (err) {
			throw err;
		}
	});

	classification_info[activeFilePath] = activeClassName;
	classification_info[newFilePath] = classification_info[activeFilePath];
	delete classification_info[activeFilePath];
	
	fileList[currentFileIndex] = newFilePath;
	fileListNode.children[currentFileIndex].textContent = activeFileName;
	if (isClass) {
		fileListNode.children[currentFileIndex].style.color = 'green';
	} else {
		fileListNode.children[currentFileIndex].style.color = 'red';
	}
	if (currentFileIndex !== fileList.length - 1) {
		changeIndex(currentFileIndex + 1);
	}
};

const handleRemoveButton = (event) => {
	// if the removed folder does not exist create it
	// move the current image into the remove folder
	// process image as you would any other classified image
	try {
		fs.statSync(`${containingFolder}${slash}Removed${slash}`);
		moveImageHandler('Removed', false);
	} catch (err) {
		if (err) {
			try {
				fs.mkdirSync(`${containingFolder}${slash}Removed${slash}`);
				moveImageHandler('Removed', false);
			} catch (err) {
				throw err;
			}
		}
	}
};

const revealConfirmButton = () => {
	confirmButtonActive = false;
	confirmButton.style.opacity = 0.1;
	confirmButton.style.visibility = 'visible';
};

// handle activation of the confirm button
// add click listener that moves the image to the correct folder and handles side effects.
let handleConfirmClick;
const activateConfirmButton = () => {
	confirmButtonActive = true;
	confirmButton.classList.replace('confirmButton', 'confirmButtonActive');
	confirmButton.style.opacity = 1;
	confirmButton.addEventListener(
		'click',
		(handleConfirmClick = function(event) {
			const activeClassName = classListNode.children[currentClassIndex].textContent;

			moveImageHandler(activeClassName);
		})
	);
};

const deactivateConfirmButton = () => {
	confrimButtonActive = false;
	confirmButton.classList.replace('confirmButtonAcitve', 'confirmButton');
	confirmButton.style.opacity = 0.1;
	confirmButton.removeEventListener('click', handleConfirmClick);
};

// function used to handle a change in the index
// loads the correct image, sets the correct file to active and deals with button hiding
const changeIndex = (newIndex) => {
	if (newIndex > 0 && currentFileIndex === 0) {
		showButton(prevButton, handlePrevButton);
	} else if (newIndex < fileList.length - 1 && currentFileIndex === fileList.length - 1) {
		showButton(nextButton, handleNextButton);
	}

	fileListNode.children[currentFileIndex].classList.remove('active_file');
	currentFileIndex = newIndex;
	fileListNode.children[currentFileIndex].classList.add('active_file');
	image.src = fileList[currentFileIndex];

	if (currentFileIndex === 0) {
		hideButton(prevButton, handlePrevButton);
	} else if (currentFileIndex === fileList.length - 1) {
		hideButton(nextButton, handleNextButton);
	}

	if (classification_info[fileList[currentFileIndex]]) {
		storedClass = classification_info[fileList[currentFileIndex]];
		classHeader.textContent = storedClass;

		const classIndex = [ ...classListNode.children ].indexOf(document.querySelector(`#${storedClass}`));
		changeClass(classIndex);
	}
};

// function used to handle which class is acitve
const changeClass = (newClassIndex) => {
	if (currentClassIndex !== undefined) {
		classListNode.children[currentClassIndex].classList.remove('active_class');
	}
	classListNode.children[newClassIndex].classList.add('active_class');
	currentClassIndex = newClassIndex;
	classHeader.textContent = classListNode.children[currentClassIndex].textContent;
};

const isValidClass = (str) => {
	let code, i, len;

	if (str.length === 0) {
		return false;
	}

	if (str.includes('-class')) {
		return false;
	}

	for (i = 0, len = str.length; i < len; i++) {
		code = str.charCodeAt(i);
		if (
			!(code > 47 && code < 58) && // numeric (0-9)
			!(code > 64 && code < 91) && // upper alpha (A-Z)
			!(code > 96 && code < 123) && // lower alpha (a-z)
			!(code === 45 || code === 95)
		) {
			return false;
		}
	}
	return true;
};

const setupClassProperties = (node) => {
	const nodeIndex = [ ...classListNode.children ].indexOf(node);

	if (nodeIndex % 2 === 1) {
		node.classList.add('odd_class');
	}

	// changes the active class when clicked
	node.addEventListener('click', function(event) {
		changeClass(nodeIndex);
		if (!isEditingToggled && !confirmButtonActive) {
			activateConfirmButton();
		}
	});

	// deals with the editing of classes
	node.addEventListener('click', function(event) {
		if (isEditingToggled) {
			isEditingClassName = false;
			editingClassItem = document.createElement('input');
			editingClassItem.value = event.target.textContent;
			editingClassItem.className = 'creating_class';
			editingClassItem.id = event.target.textContent;
			classListNode.replaceChild(editingClassItem, node);
			confirmClassItem(editingClassItem);
			editingClassItem.focus();
		}
	});

	// when a class is clicked cancel editing mode and prevent user from toggling again until edit is confirmed
	node.addEventListener('click', function(event) {
		if (isEditingToggled) {
			editClass.removeEventListener('click', handleEditClass);
			isEditingToggled = false;
			editClass.classList.replace('class_editing--edit--active', 'class_editing--edit');
		}
	});

	for (let i = 0; i < classListNode.children.length; i++) {
		classListNode.children[i].classList.replace(
			'class_names_container--classListItemEditing',
			'class_names_container--classListItem'
		);
	}

	editClass.addEventListener('click', handleEditClass);
};

// function used to confirm the class name from an input node
const confirmClassItem = (node) => {
	node.addEventListener('keypress', function(event) {
		const key = event.which || event.keyCode;
		if (key === 13) {
			let classItem = document.createElement('div');
			classItem.id = event.target.value;
			classItem.className = 'class_names_container--classListItem';
			classItem.textContent = event.target.value;

			if (classContainer.contains(document.querySelector('#sameNameWarning'))) {
				classContainer.removeChild(document.querySelector('#sameNameWarning'));
			}

			if (classContainer.contains(document.querySelector('#invalidClassNameWarning'))) {
				classContainer.removeChild(document.querySelector('#invalidClassNameWarning'));
			}

			if (!isValidClass(event.target.value)) {
				let invalidClassNameWarning = document.createElement('div');
				invalidClassNameWarning.style.color = 'red';
				invalidClassNameWarning.style.margin = '1rem 0';
				if (event.target.value.length === 0) {
					invalidClassNameWarning.textContent = 'Class name cannot be empty.';
				} else if (event.target.value.includes('-class')) {
					invalidClassNameWarning.textContent = 'Class name cannot include "-class".';
				} else {
					invalidClassNameWarning.textContent = 'Class name can only contain letters, numbers, - and _.';
				}
				invalidClassNameWarning.id = 'invalidClassNameWarning';
				if (!classContainer.contains(document.querySelector('#invalidClassNameWarning'))) {
					classContainer.appendChild(invalidClassNameWarning);
				}
			} else if (
				classListNode.contains(document.querySelector('#' + classItem.id)) &&
				node.id !== event.target.value
			) {
				sameNameWarning = document.createElement('div');
				sameNameWarning.style.color = 'red';
				sameNameWarning.style.margin = '1rem 0';
				sameNameWarning.textContent = "Can't have two classes with the same name!";
				sameNameWarning.id = 'sameNameWarning';
				if (!classContainer.contains(document.querySelector('#sameNameWarning'))) {
					classContainer.appendChild(sameNameWarning);
				}
			} else {
				classListNode.replaceChild(classItem, node);
				classFolderPath = containingFolder + slash + event.target.value + '-class' + slash;
				try {
					fs.statSync(classFolderPath);
				} catch (err) {
					if (err && !isEditingClassName) {
						const oldClassFolderPath = containingFolder + slash + node.id + '-class' + slash;
						fileList.forEach((ele, idx) => {
							if (path.parse(ele).dir + slash === oldClassFolderPath) {
								const newFilePath = classFolderPath + path.parse(ele).base;
								fileList[idx] = newFilePath;
								classification_info[ele] = event.target.value;
								classification_info[newFilePath] = classification_info[ele];
								delete classification_info[ele];
							}
						});
						fs.rename(oldClassFolderPath, classFolderPath, (err) => {
							if (err) {
								throw err;
							}
						});
					} else if (err) {
						fs.mkdir(classFolderPath, (err) => {
							if (err) {
								throw err;
							}
						});
					}
				}

				setupClassProperties(classItem);

				if (fileList.length > 0 && classListNode.children.length === 1) {
					revealConfirmButton();
				}

				isEditingClassName = true;
			}
		}
	});
};

// listening for a click on the folder button.
// when clicked it loads all the images into the file list and opens the first image
folderButton.addEventListener('click', function(event) {
	dialog.showOpenDialog(
		{
			properties: [ 'openDirectory' ]
		},
		function(dir) {
			if (dir !== undefined) {
				containingFolder = dir[0];

				// handle files
				(async () => {
					const paths = await globby([
						`${dir}/+(*.png|*.jpg|*.jpeg|*.tif|*.tiff|*.PNG|*.JPG|*.JPEG|*.TIF|*.TIFF)`,
						`${dir}/*-class/+(*.png|*.jpg|*.jpeg|*.tif|*.tiff|*.PNG|*.JPG|*.JPEG|*.TIF|*.TIFF)`
					]);

					fileList = paths;

					deactivateConfirmButton();

					if (currentFileIndex) {
						fileListNode.children[currentFileIndex].classList.remove('active_file');
					}

					currentFileIndex = 0;

					if (fileList.length > 0 && classListNode.children.length > 0) {
						revealConfirmButton();
					}

					if (fileList.length > 0) {
						fileList.forEach((ele) => {
							let filePath = path.parse(ele).dir;
							if (isWin) {
								filePath = path.parse(ele).dir.replace(/\//g, '\\');
							}

							if (filePath === containingFolder) {
								classification_info[ele] = '';
							} else {
								classification_info[ele] = path.parse(path.parse(ele).dir).base.replace('-class', '');
							}
						});
						image.src = fileList[currentFileIndex];
						showButton(removeButton, handleRemoveButton);
						showButton(nextButton, handleNextButton);
						hideButton(prevButton, handlePrevButton);
					}

					classHeader.textContent = classification_info[fileList[currentFileIndex]];

					if (fileListNode.hasChildNodes) {
						while (fileListNode.firstChild) {
							fileListNode.removeChild(fileListNode.firstChild);
						}
					}

					for (let i = 0; i < fileList.length; i++) {
						const testItem = document.createElement('div');
						testItem.textContent = path.parse(fileList[i]).base;
						testItem.id = 'file' + i;
						fileListNode.appendChild(testItem);
					}

					// need to add found classes to the class list also
					glob(dir + '/*-class/', function(err, folders) {
						if (classListNode.hasChildNodes) {
							while (classListNode.firstChild) {
								classListNode.removeChild(classListNode.firstChild);
							}
						}

						for (let i = 0; i < folders.length; i++) {
							(function() {
								const classItemName = path.parse(folders[i]).base.replace('-class', '');
								if (!classListNode.contains(document.querySelector('#' + classItemName))) {
									let classItem = document.createElement('div');
									classItem.id = classItemName;
									classItem.className = 'class_names_container--classListItem';
									classItem.textContent = classItemName;
									classListNode.appendChild(classItem);

									setupClassProperties(classItem);
								}
							})();
						}

						if (fileList.length > 0 && classListNode.children.length > 0) {
							revealConfirmButton();
							if (currentClassIndex) {
								activateConfirmButton();
							}
						}
					});

					fileListNode.children[currentFileIndex].classList.add('active_file');

					for (let i = 0; i < fileListNode.children.length; i++) {
						if (classification_info[fileList[i]] !== '') {
							fileListNode.children[i].style.color = 'green';
						}
						fileListNode.children[i].addEventListener('click', function(event) {
							changeIndex(i);
						});
					}
				})();
			}
		}
	);
});

// listening for add button click
addClass.addEventListener('click', function() {
	const classInput = document.createElement('input');
	classInput.type = 'text';
	classInput.classList.add('creating_class');
	classListNode.appendChild(classInput);
	confirmClassItem(classInput);
	classInput.focus();
});

// listening for the edit button click, toggles the editing state
let handleEditClass;
editClass.addEventListener(
	'click',
	(handleEditClass = function(event) {
		isEditingToggled = !isEditingToggled;
		if (isEditingToggled) {
			if (currentClassIndex) {
				classListNode.children[currentClassIndex].classList.remove('active_file');
			}
			deactivateConfirmButton();
			editClass.classList.replace('class_editing--edit', 'class_editing--edit--active');
			for (let i = 0; i < classListNode.children.length; i++) {
				classListNode.children[i].classList.replace(
					'class_names_container--classListItem',
					'class_names_container--classListItemEditing'
				);
			}
		} else {
			editClass.classList.replace('class_editing--edit--active', 'class_editing--edit');
			for (let i = 0; i < classListNode.children.length; i++) {
				classListNode.children[i].classList.replace(
					'class_names_container--classListItemEditing',
					'class_names_container--classListItem'
				);
			}
		}
	})
);
