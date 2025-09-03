/**
 * Otevře modální okno se zvětšeným obrázkem.
 * @param {string} imageUrl URL obrázku ve vysokém rozlišení.
 */
function openModal(imageUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');

    modal.style.display = 'block';
    modalImg.src = imageUrl;
}

/**
 * Zavře modální okno.
 * @param {Event} event Událost kliknutí.
 */
function closeModal(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal || event.target.className === 'close-btn') {
        modal.style.display = 'none';
    }
}