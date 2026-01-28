/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Traditional Chinese Medicine Color Palette
                tcm: {
                    red: {
                        50: '#fef2f2',
                        100: '#fee2e2',
                        200: '#fecaca',
                        300: '#fca5a5',
                        400: '#f87171',
                        500: '#dc2626',  // Main red
                        600: '#b91c1c',
                        700: '#991b1b',
                        800: '#7f1d1d',
                        900: '#661515',
                    },
                    gold: {
                        50: '#fffbeb',
                        100: '#fef3c7',
                        200: '#fde68a',
                        300: '#fcd34d',
                        400: '#fbbf24',
                        500: '#f59e0b',  // Main gold
                        600: '#d97706',
                        700: '#b45309',
                        800: '#92400e',
                        900: '#78350f',
                    },
                    green: {
                        50: '#f0fdf4',
                        100: '#dcfce7',
                        200: '#bbf7d0',
                        300: '#86efac',
                        400: '#4ade80',
                        500: '#22c55e',  // Herbal green
                        600: '#16a34a',
                        700: '#15803d',
                        800: '#166534',
                        900: '#14532d',
                    },
                    brown: {
                        50: '#fdf8f6',
                        100: '#f2e8e5',
                        200: '#eaddd7',
                        300: '#e0cec7',
                        400: '#d2bab0',
                        500: '#bfa094',  // Wood brown
                        600: '#a18072',
                        700: '#977669',
                        800: '#846358',
                        900: '#43302b',
                    },
                    herbal: {
                        50: '#f7fee7',
                        100: '#ecfccb',
                        200: '#d9f99d',
                        300: '#bef264',
                        400: '#a3e635',
                        500: '#84cc16',  // Herbal medicine
                        600: '#65a30d',
                        700: '#4d7c0f',
                        800: '#3f6212',
                        900: '#365314',
                    }
                },
                primary: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#dc2626',
                    600: '#b91c1c',
                    700: '#991b1b',
                    800: '#7f1d1d',
                    900: '#661515',
                },
            },
            fontFamily: {
                'chinese': ['Noto Serif SC', 'serif'],
                'elegant': ['Playfair Display', 'serif'],
            },
            backgroundImage: {
                'tcm-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            },
        },
    },
    plugins: [],
}
