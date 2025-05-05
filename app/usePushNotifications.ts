import { useEffect, useState, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { Platform } from "react-native";
import { saveNotificationToken } from "./services/ApiService";

export interface PushNotificationState {
    notification?: Notifications.Notification | null;
    expoPushToken?: Notifications.ExpoPushToken | null;
}

export const usePushNotifications = (): PushNotificationState => {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    const [expoPushToken, setExpoPushToken] = useState<Notifications.ExpoPushToken | undefined>(undefined);

    const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);

    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    async function registerForPushNotificationsAsync() {
        let token;
        console.log(Device);
        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            console.log("existingStatus", existingStatus);

            if (existingStatus !== "granted") {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            console.log("finalStatus", finalStatus);
            if (finalStatus !== "granted") {
                return;
            }
            console.log("finalStatus", finalStatus);

            let projectId = Constants.expoConfig?.extra?.eas?.projectId;
            console.log("projectId", projectId);

            try {
                console.log("Getting Expo push token...");
                token = await Notifications.getExpoPushTokenAsync({
                    projectId: projectId,
                });
                await AsyncStorage.setItem("expoPushToken", token.data);
            }
            catch (error) {
                console.error("Error getting Expo push token:", error);
                return;
            }

            console.log("here");
            console.log("Token", token);

            if (Platform.OS === "android") {
                console.log("Setting up Android notification channel");
                Notifications.setNotificationChannelAsync("default", {
                    name: "default",
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: "#FF231F7C",
                });
                console.log("Android notification channel set up");
            }

            saveNotificationToken(token.data).then((response) => {
                console.log("Notification token saved successfully:", response);
            }
            ).catch((error) => {
                console.error("Error saving notification token:", error);
            });

            return token.data;
        }
        else {
            console.log("Must use physical device for Push Notifications");
            return;
        }
    }

    useEffect(() => {
        registerForPushNotificationsAsync().then((token) => {
            setExpoPushToken(token ? { type: "expo", data: token } : undefined);
        });

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log("response:", response);
        });

        return () => {
            Notifications.removeNotificationSubscription(notificationListener.current!);
            Notifications.removeNotificationSubscription(responseListener.current!);
        }

    }, []);


    return { expoPushToken, notification };
};