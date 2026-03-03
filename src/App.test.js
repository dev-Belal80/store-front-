import { render, screen } from '@testing-library/react';
import App from './App.jsx';

test('renders login heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/تسجيل الدخول/i);
  expect(headingElement).toBeInTheDocument();
});
