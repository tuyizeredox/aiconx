import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { usersAPI } from '@/api/apiClient';

export const setupPushNotifications = async () => {
  // Try web notifications if not on native platform
  if (!Capacitor.isNativePlatform()) {
    console.log('Native push notifications not available on web, attempting web notifications...');
    return setupWebNotifications();
  }

  try {
    // Clear any existing listeners first to avoid duplicates
    await PushNotifications.removeAllListeners();

    // Request permission to use push notifications
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('User denied permissions!');
      return;
    }

    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      try {
        await usersAPI.registerPushToken(token.value);
      } catch (err) {
        console.error('Failed to register push token with backend', err);
      }
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
      // In-app alert or notification list update could happen here
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      const data = notification.notification.data;
      if (data && data.link) {
        window.location.href = data.link;
      }
    });

  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
};

// Auto-setup when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Device back online, re-initializing push notifications...');
    setupPushNotifications();
  });
}

export const removePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    await unsubscribeFromPushNotifications();
    return;
  }

  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error removing push notification listeners:', error);
  }
};

// Converts the VAPID public key (base64url) into the Uint8Array format
// required by PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export const setupWebNotifications = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('This browser does not support desktop notifications');
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      console.log('Web notification permission:', permission);
      return;
    }

    console.log('Web notification permission granted');
    await subscribeToPushNotifications();
  } catch (err) {
    console.error('Error requesting web notification permission:', err);
  }
};

// Registers the service worker and subscribes to push so notifications keep
// arriving even when the browser tab/PWA is closed.
export const subscribeToPushNotifications = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('This browser does not support push notifications');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const { publicKey } = await usersAPI.getPushVapidPublicKey();
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await usersAPI.subscribeToPush(subscription.toJSON());
    console.log('Push subscription registered with backend');
  } catch (err) {
    console.error('Error subscribing to push notifications:', err);
  }
};

// Unsubscribes this device from push, e.g. on logout.
export const unsubscribeFromPushNotifications = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      await usersAPI.unsubscribeFromPush(subscription.endpoint);
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('Error unsubscribing from push notifications:', err);
  }
};

export const showLocalNotification = (title, body, data = {}) => {
  if (Capacitor.isNativePlatform()) {
    // For native, we could use LocalNotifications plugin if installed
    // But Capacitor.push-notifications already shows notifications in foreground if configured
    console.log('Native local notification (via Capacitor):', { title, body, data });
  } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: body,
      icon: '/favicon.ico', // Adjust icon path as needed
      data: data
    });

    notification.onclick = (event) => {
      event.preventDefault();
      if (data.link) {
        window.location.href = data.link;
      }
      window.focus();
      notification.close();
    };
  }
};
