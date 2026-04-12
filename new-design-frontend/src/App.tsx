import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from '@/src/app/providers';
import { AppRouter } from '@/src/app/router';

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  );
}
