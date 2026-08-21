/**
 * Handing the finished collage to Instagram's story composer.
 *
 * Two things that bite everyone who does this:
 *
 * - The URI has to be a FileProvider `content://` URI. A `file://` path throws
 *   FileUriExposedException on Android 7+, or shows up as a black screen.
 *   `getContentUriAsync` does that for us, and as of SDK 57 it lives in
 *   `expo-file-system/legacy` — the new File API has no equivalent yet.
 *   TODO: move off `/legacy` once expo-file-system exposes content URIs again.
 * - Instagram needs read permission on that URI, granted here via
 *   FLAG_GRANT_READ_URI_PERMISSION on the intent.
 *
 * Note that we deliberately leave the intent implicit. expo-intent-launcher
 * only sets the target component when you also give it an activity class name
 * (see IntentLauncherModule.kt), so there is no `setPackage` equivalent — but
 * Instagram is the only app that declares this action, so it resolves anyway.
 */
import * as IntentLauncher from 'expo-intent-launcher';
import { getContentUriAsync } from 'expo-file-system/legacy';

const ADD_TO_STORY = 'com.instagram.share.ADD_TO_STORY';
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;

export type StoryShareResult = 'opened' | 'no-instagram';

/**
 * Opens Instagram's story composer with `fileUri` as the full-bleed background.
 *
 * Background rather than sticker on purpose: Instagram places a sticker asset
 * as a movable, shrunk-down element, which throws away the full-screen layout
 * the app just built.
 *
 * `sourceApplication` is a Facebook App ID. Meta documents it as required, but
 * on Android it is an attribution extra and the intent works without one.
 */
export async function shareToInstagramStory(
  fileUri: string,
  sourceApplication?: string
): Promise<StoryShareResult> {
  const contentUri = await getContentUriAsync(fileUri);
  try {
    await IntentLauncher.startActivityAsync(ADD_TO_STORY, {
      data: contentUri,
      type: 'image/jpeg',
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      ...(sourceApplication ? { extra: { source_application: sourceApplication } } : {}),
    });
    return 'opened';
  } catch {
    // ActivityNotFoundException: Instagram isn't installed, or is too old to
    // declare the action. The collage is already in the gallery either way.
    return 'no-instagram';
  }
}
