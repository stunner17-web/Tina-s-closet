const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

menuToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});




// Category filter tabs
const tabs = document.querySelectorAll('.tab');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const filter = tab.dataset.filter;
    const items = document.querySelectorAll('.best-selling .item');

    items.forEach(item => {
      if (filter === 'all' || item.dataset.category === filter) {
        item.classList.remove('hide');
      } else {
        item.classList.add('hide');
      }
    });
  });
});


// "Shop Collection" buttons show all products
document.querySelectorAll('.show-all').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.tab[data-filter="all"]').click();
  });
});