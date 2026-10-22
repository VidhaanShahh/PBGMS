import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_SEO = {
  '/': {
    title: 'Pet Boarding & Grooming Management System (PBGMS)',
    description: 'Premier pet boarding suites and master grooming spa services with verified vaccination safety in India.',
    isPrivate: false
  },
  '/login': {
    title: 'Login | PBGMS Portal',
    description: 'Sign in to access your PBGMS Pet Owner, Staff, or Administrative dashboard.',
    isPrivate: false
  },
  '/admin/login': {
    title: 'Staff & Admin Login | PBGMS',
    description: 'PBGMS operational authentication portal for Front Desk, Groomers, Attendants, and Admins.',
    isPrivate: false
  },
  '/register': {
    title: 'Register Pet Owner Account | PBGMS',
    description: 'Create an account to register your pets, track vaccination compliance, and schedule boarding stays.',
    isPrivate: false
  },
  '/my-pets': {
    title: 'My Pets | PBGMS Portal',
    isPrivate: true
  },
  '/boarding/book': {
    title: 'Book Boarding Suite | PBGMS',
    isPrivate: true
  },
  '/grooming/book': {
    title: 'Reserve Grooming Spa | PBGMS',
    isPrivate: true
  },
  '/my-bookings': {
    title: 'My Bookings & Care History | PBGMS',
    isPrivate: true
  },
  '/front-desk': {
    title: 'Front Desk Operations Portal | PBGMS',
    isPrivate: true
  },
  '/groomer': {
    title: 'Groomer Studio Portal | PBGMS',
    isPrivate: true
  },
  '/staff/dashboard': {
    title: 'Staff Operations & Daily Care Logs | PBGMS',
    isPrivate: true
  },
  '/admin/dashboard': {
    title: 'System Administration Dashboard | PBGMS',
    isPrivate: true
  }
};

/**
 * RouteMetaController dynamically updates document.title and
 * meta robots tag to ensure private dashboards have noindex/nofollow
 * while public marketing routes have descriptive titles and meta descriptions.
 */
export default function RouteMetaController() {
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;
    let config = ROUTE_SEO[currentPath];

    // Handle parameterized routes like /payment/:bookingId or fallback
    if (!config) {
      if (currentPath.startsWith('/payment') || currentPath.startsWith('/confirmation')) {
        config = { title: 'Payment Settlement | PBGMS', isPrivate: true };
      } else if (currentPath.startsWith('/admin')) {
        config = { title: 'Administrative Console | PBGMS', isPrivate: true };
      } else {
        config = { title: 'PBGMS - Pet Boarding & Grooming Management System', isPrivate: false };
      }
    }

    // Update document title
    if (config.title) {
      document.title = config.title;
    }

    // Update or insert robots meta tag
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }

    if (config.isPrivate) {
      robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');
    } else {
      robotsMeta.setAttribute('content', 'index, follow');
    }

    // Update meta description if public
    if (config.description) {
      let descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) {
        descMeta.setAttribute('content', config.description);
      }
    }
  }, [location.pathname]);

  return null;
}
