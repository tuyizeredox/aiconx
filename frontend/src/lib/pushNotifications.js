import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { usersAPI } from '@/api/apiClient';

// Cached so removePushNotifications() can unregister the same token on logout.
let currentNativeToken = null;

export const setupPushNotifications = async () => {
  // Try web notifications if not on native platform
  if (!Capacitor.isNativePlatform()) {
    console.log('Native push notifications not available on web, attempting web notifications...');
    return setupWebNotifications();
  }

  try {
    // Clear any existing listeners first to avoid duplicates
    await PushNotifications.removeAllListeners();
    await LocalNotifications.removeAllListeners();

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

    // Android only auto-displays a push's system-tray banner while the app is
    // backgrounded/killed; in the foreground it's handed to the listener below
    // instead, so we need LocalNotifications to show it ourselves.
    try {
      const localPerm = await LocalNotifications.checkPermissions();
      if (localPerm.display === 'prompt') {
        await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.error('Failed to request local notification permission', err);
    }

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      currentNativeToken = token.value;
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

    // Foreground pushes reach here instead of the system tray, so display
    // them ourselves via a local notification.
    PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
      try {
        await LocalNotifications.schedule({
          notifications: [{
            id: Date.now() % 2147483647,
            title: notification.title || 'AiconX',
            body: notification.body || '',
            extra: notification.data || {},
          }],
        });
      } catch (err) {
        console.error('Failed to show local notification for foreground push', err);
      }
    });

    // Method called when tapping on a notification delivered while backgrounded/killed
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      const data = notification.notification.data;
      if (data && data.link) {
        window.location.href = data.link;
      }
    });

    // Method called when tapping a notification we displayed ourselves (foreground case)
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const data = action.notification.extra;
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
    if (currentNativeToken) {
      await usersAPI.unregisterPushToken(currentNativeToken);
      currentNativeToken = null;
    }
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
