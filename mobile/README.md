# SpendWise mobile

This Expo React Native app uses the same account and API as the website. It includes Overview, Expenses, Income, Budgets, Reminders, Scheduled messages, and Reports.

## Run on a phone

1. Install the current Node.js LTS and the Expo Go app on your phone.
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the public API URL ending in `/api`. A physical phone cannot reach your computer through `localhost`.
3. Run `npm install`, then `npx expo start` from this folder. Scan the displayed QR code with Expo Go.

## Create an Android install package

Install and sign in to EAS CLI, then run `eas build --platform android --profile preview`. The preview profile creates an installable APK. EAS internal distribution provides a link to install it on a phone. For iOS device installs, Apple signing and device provisioning are required.

See Expo's [project setup](https://docs.expo.dev/get-started/create-a-project/) and [internal distribution](https://docs.expo.dev/build/internal-distribution/) guides.
