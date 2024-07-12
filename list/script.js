var currentGen = null;

function toggleGen(generationClass) {
    var allDivs = document.querySelectorAll('.gen-row');
    
    // Check if the current generation is already shown
    if (currentGen === generationClass) {
        // Show all divs
        allDivs.forEach(function(div) {
            div.classList.remove('hidden');
        });
        currentGen = null;
    } else {
        // Hide all divs
        allDivs.forEach(function(div) {
            div.classList.add('hidden');
        });
        
        // Show only the selected generation
        var genDivs = document.querySelectorAll('.' + generationClass);
        genDivs.forEach(function(div) {
            div.classList.remove('hidden');
        });
        
        currentGen = generationClass;
    }
}

function toggleGen1() {
    toggleGen('generation-1');
}

function toggleGen2() {
    toggleGen('generation-2');
}

function toggleGen3() {
    toggleGen('generation-3');
}

function toggleGen4() {
    toggleGen('generation-4');
}

function toggleGen5() {
    toggleGen('generation-5');
}

function toggleGen6() {
    toggleGen('generation-6');
}

function toggleGen7() {
    toggleGen('generation-7');
}

function toggleGen8() {
    toggleGen('generation-8');
}

function toggleGen9() {
    toggleGen('generation-9');
}

function toggleHome() {
    toggleGen('home');
}

/* For when its needed
function toggleNew() {
    toggleGen('');
}

function toggleInProgress() {
    toggleGen('');
}

function toggleCompleted() {
    toggleGen('');
}
*/



// Script that disables and enables the badges and stuff

document.addEventListener('DOMContentLoaded', () => {
    // Function to save checkbox state in local storage
    function saveCheckboxState(checkbox) {
        const checkboxId = checkbox.id;
        const isChecked = checkbox.checked;
        localStorage.setItem(checkboxId, isChecked);
    }

    // Function to load checkbox states from local storage
    function loadCheckboxStates() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            const savedState = localStorage.getItem(checkbox.id);
            if (savedState !== null) {
                checkbox.checked = savedState === 'true';
            }
        });
    }

    // Update badge visibility based on checkbox states
    function updateBadges(gameId) {
        const allCheckboxes = Object.keys(localStorage)
            .filter(key => key.startsWith(`${gameId}-checkbox-`));

        let anyChecked = false;
        let allChecked = allCheckboxes.length > 0;

        allCheckboxes.forEach(id => {
            const isChecked = localStorage.getItem(id) === 'true';
            anyChecked = anyChecked || isChecked;
            allChecked = allChecked && isChecked;
        });

        const inProgressBadge = document.getElementById(`inProgressBadge_${gameId}`);
        const completedBadge = document.getElementById(`completedBadge_${gameId}`);

        if (allChecked) {
            completedBadge.style.display = 'inline';
            inProgressBadge.style.display = 'none';
        } else if (anyChecked) {
            inProgressBadge.style.display = 'inline';
            completedBadge.style.display = 'none';
        } else {
            inProgressBadge.style.display = 'none';
            completedBadge.style.display = 'none';
        }
    }

    // Check if on the game page
    const isGamePage = document.querySelector('.page-container') !== null;

    if (isGamePage) {
        // Handle game page functionality
        const gameElement = document.querySelector('.page-container');
        const gameId = gameElement.dataset.game;
        const checkboxes = document.querySelectorAll(`.page-container input[type="checkbox"]`);

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                saveCheckboxState(event.target);
                updateBadges(gameId);
            });
            const savedState = localStorage.getItem(checkbox.id);
            if (savedState !== null) {
                checkbox.checked = savedState === 'true';
            }
        });

        // Initial badge update
        updateBadges(gameId);
    } else {
        // Handle game list page functionality
        const gameItems = document.querySelectorAll('.gen-item[data-game]');
        gameItems.forEach(gameItem => {
            const gameId = gameItem.dataset.game;
            updateBadges(gameId);
        });
    }
});