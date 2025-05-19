document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll('.slide');
  const track = document.querySelector('.carousel-track');
  const container = document.querySelector('.carousel-container'); // ★追加
  let currentIndex = 0;
  let interval;

  function updateCarousel() {
    slides.forEach((slide) => {
      slide.classList.remove('active');
    });
    slides[currentIndex].classList.add('active');

    const offset = -100 * currentIndex;
    track.style.transform = `translateX(${offset}%)`;
  }

  function nextSlide() {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
  }

  function startInterval() {
    interval = setInterval(nextSlide, 4000);
  }

  function stopInterval() {
    clearInterval(interval);
  }

  container.addEventListener('mouseenter', stopInterval);
  container.addEventListener('mouseleave', startInterval);

  updateCarousel();
  startInterval();
});
