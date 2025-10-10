/* Patches Loader → single ordered boot path via boot loader */
import { CORE, PATCHES, REQUIRED } from '../boot/manifest.js';
import { ensureCoreThenPatches } from '../boot/boot_hardener.js';

export default ensureCoreThenPatches({ CORE, PATCHES, REQUIRED });
