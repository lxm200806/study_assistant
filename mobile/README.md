# Study Assistant Mobile

React Native + Expo Dev Build client for the Study Assistant app.

## Development

```bash
cd mobile
npm install
npm run start
```

Use a development build for native audio and microphone testing:

```bash
npm run android
npm run ios
```

Set `EXPO_PUBLIC_API_BASE_URL` when the backend is not reachable at the default URL:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3004/api npm run start
```

Android emulators should usually use `http://10.0.2.2:3004/api`. iOS simulators can usually use `http://127.0.0.1:3004/api`.
