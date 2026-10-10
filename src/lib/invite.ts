/** "Invite a reader": the native share sheet with a link to the BookDate site. */
import { Share } from 'react-native';

import { analytics } from './analytics';
import { config } from './config';

export async function inviteFriend() {
  const res = await Share.share({ message: `I'm on BookDate: swipe on book covers and match with readers nearby who loved the same book. ${config.siteUrl}` });
  if (res.action === Share.sharedAction) analytics.track('invite_shared');
}
