document.addEventListener('DOMContentLoaded', () => {
    // Inicializace galerií pro všechny stránky
    const galleryContainers = document.querySelectorAll('.gallery-container');

    galleryContainers.forEach(container => {
        const gallery = container.querySelector('.gallery');
        const images = gallery.querySelectorAll('.gallery-image');
        const prevBtn = container.querySelector('.gallery-prev');
        const nextBtn = container.querySelector('.gallery-next');

        let currentIndex = 0;
        const totalImages = images.length;
        const intervalTime = 5000; // Automatické posouvání po 5 sekundách
        let autoSlideInterval;

        // Skryjeme všechny obrázky kromě prvního
        images.forEach((img, index) => {
            if (index !== 0) {
                img.style.display = 'none';
            }
        });
        
        function updateGallery() {
            images.forEach((img, index) => {
                img.style.display = 'none';
            });
            images[currentIndex].style.display = 'block';
        }

        function nextSlide() {
            currentIndex = (currentIndex + 1) % totalImages;
            updateGallery();
        }

        function prevSlide() {
            currentIndex = (currentIndex - 1 + totalImages) % totalImages;
            updateGallery();
        }

        // Tlačítka
        prevBtn.addEventListener('click', () => {
            prevSlide();
            resetAutoSlide();
        });

        nextBtn.addEventListener('click', () => {
            nextSlide();
            resetAutoSlide();
        });

        // Automatické posouvání
        function startAutoSlide() {
            autoSlideInterval = setInterval(nextSlide, intervalTime);
        }

        function resetAutoSlide() {
            clearInterval(autoSlideInterval);
            startAutoSlide();
        }

        // Inicializujeme první obrázek a automatické posouvání
        updateGallery();
        startAutoSlide();
    });
});