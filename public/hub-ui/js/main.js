document.addEventListener('DOMContentLoaded', () => {

  // ========================================
  // Sidebar collapsible groups
  // ========================================
  const groupTitles = document.querySelectorAll('.sidebar-group-title');
  groupTitles.forEach(title => {
    title.addEventListener('click', () => {
      const targetId = title.getAttribute('data-toggle');
      const nav = document.getElementById(targetId);
      if (!nav) return;

      const isCollapsed = nav.style.display === 'none';
      nav.style.display = isCollapsed ? 'flex' : 'none';
      title.classList.toggle('collapsed', !isCollapsed);
    });
  });

  // ========================================
  // Sidebar nav active state
  // ========================================
  const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
  sidebarLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      // Remove active from all links in same nav
      const parentNav = this.closest('.sidebar-nav');
      if (parentNav) {
        parentNav.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      }
      this.classList.add('active');
    });
  });

  // ========================================
  // Table of Contents active state
  // ========================================
  const tocLinks = document.querySelectorAll('.toc-link');
  tocLinks.forEach(link => {
    link.addEventListener('click', function () {
      tocLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // ========================================
  // Scroll spy for TOC (if sections exist)
  // ========================================
  const observerOptions = {
    root: null,
    rootMargin: '-80px 0px -60% 0px',
    threshold: 0
  };

  const tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, observerOptions);

  // Observe all sections with IDs
  document.querySelectorAll('[id]').forEach(section => {
    if (section.tagName === 'H2' || section.tagName === 'H3') {
      tocObserver.observe(section);
    }
  });

  // ========================================
  // Copy code block
  // ========================================
  const copyBtns = document.querySelectorAll('.code-block-header span:last-child');
  copyBtns.forEach(btn => {
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', function () {
      const codeBody = this.closest('.code-block').querySelector('.code-block-body');
      if (codeBody) {
        const text = codeBody.innerText;
        navigator.clipboard.writeText(text).then(() => {
          const original = this.textContent;
          this.textContent = '✅';
          setTimeout(() => { this.textContent = original; }, 1500);
        });
      }
    });
  });

  // ========================================
  // Animate elements on scroll
  // ========================================
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        animateObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.fw-card, .doc-card, .stat-item, .docs-feature-card, .why-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    animateObserver.observe(el);
  });

  // ========================================
  // Search bar focus (placeholder)
  // ========================================
  const searchBars = document.querySelectorAll('.nav-search, .sidebar-search');
  searchBars.forEach(bar => {
    bar.addEventListener('click', () => {
      // Placeholder: could open a search modal
      bar.style.borderColor = 'var(--border-active)';
      setTimeout(() => {
        bar.style.borderColor = '';
      }, 300);
    });
  });

});
