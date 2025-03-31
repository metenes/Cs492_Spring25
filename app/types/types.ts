// types.ts
export type RootStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
    Home: undefined;
    Profile: undefined;
    Activity: undefined;
    Settings: undefined;
    Chatbot: undefined;
    DiaryMain: undefined;
    Dashboard: undefined;
    FreeJournaling: { selectedDate: string };
    Journal: undefined;
    ActivityLog: undefined;
    PaymentMethodHistoryScreen: undefined;
    PaymentMethodSettingScreen: undefined;
    PaymentMethodAddScreen: undefined;
    FaceEmotion : undefined;
    CheckIn: undefined;
    NotificationSettingsScreen: undefined; 
    ResetPassword: { token: string }; 
    GuidedJournaling : { prompt: string };
    PromptSelection : undefined;
  };
  