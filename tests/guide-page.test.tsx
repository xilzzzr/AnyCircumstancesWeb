import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { GuidePage, preferredSourceUrl } from '@/pages/public/GuidePage';
import { guides } from '@/data/guides';

describe('guide page', () => {
  test('links to Google preferred sources for this domain, opened in a new tab', () => {
    render(
      <MemoryRouter initialEntries={[`/guides/${guides[0].slug}`]}>
        <Routes>
          <Route path="/guides/:slug" element={<GuidePage />} />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: 'Add AnyCircumstances as a preferred source on Google' });
    expect(link.getAttribute('href')).toBe(preferredSourceUrl);
    expect(new URL(preferredSourceUrl).searchParams.get('q')).toBe('anycircumstances.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
