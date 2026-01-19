import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsSection } from '../../../src/options/components/SettingsSection';

describe('SettingsSection', () => {
  it('should render children', () => {
    render(
      <SettingsSection>
        <div data-testid="child">Child content</div>
      </SettingsSection>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render title when provided', () => {
    render(
      <SettingsSection title="Test Title">
        <div>Content</div>
      </SettingsSection>
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should not render title when not provided', () => {
    const { container } = render(
      <SettingsSection>
        <div>Content</div>
      </SettingsSection>
    );

    expect(container.querySelector('h3')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <SettingsSection className="custom-class">
        <div>Content</div>
      </SettingsSection>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
    expect(wrapper.className).toContain('space-y-3');
  });

  it('should apply default spacing class', () => {
    const { container } = render(
      <SettingsSection>
        <div>Content</div>
      </SettingsSection>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('space-y-3');
  });

  it('should render title with proper heading styling', () => {
    render(
      <SettingsSection title="Styled Title">
        <div>Content</div>
      </SettingsSection>
    );

    const heading = screen.getByRole('heading', { name: 'Styled Title' });
    expect(heading.tagName).toBe('H3');
    expect(heading.className).toContain('text-sm');
    expect(heading.className).toContain('font-medium');
  });
});
