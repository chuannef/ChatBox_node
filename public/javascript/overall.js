document.addEventListener('DOMContentLoaded', function () {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.createElement('div');

    overlay.className = 'sidebar-overlay';
    document.querySelector('.container').appendChild(overlay);

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('show');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
        }
    })

    const settingsButton = document.getElementById('settingsBtn');
    const settingsPopup = document.getElementById('settingsPopup');

    function positionPopup() {
        const btnRect = settingsBtn.getBoundingClientRect();
        settingsPopup.style.top = btnRect.bottom + 8 + 'px';
        settingsPopup.style.right = window.innerWidth - btnRect.right - 40 + 'px';
    }

    // Handle the case when user click on background
    document.addEventListener('click', (e) => {
        if (!settingsButton.contains(e.target) && !settingsPopup.contains(e.target)) {
            settingsPopup.classList.remove('active');
        }
        // contextMenu.style.display = 'none';
    });


    // Toggle popup window
    settingsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = settingsPopup.classList.contains('active');
        if (!isActive) {
            positionPopup();
        }
        settingsPopup.classList.toggle('active');
    });

    // const attachBtn = document.querySelector('.attach-btn');
    // const attachOptions = document.querySelector('.attach-options');

    // attachBtn.addEventListener('click', () => {
    //     // Toggle hiển thị bảng lựa chọn
    //     attachOptions.style.display = attachOptions.style.display === 'flex' ? 'none' : 'flex';
    // });

    // // Ẩn bảng khi nhấn ra ngoài
    // document.addEventListener('click', (event) => {
    //     if (!attachBtn.contains(event.target) && !attachOptions.contains(event.target)) {
    //         attachOptions.style.display = 'none';
    //     }
    // });

});

