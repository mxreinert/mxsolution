// 404 page: show the mascot (inline scripts are blocked by the CSP, so this lives in a file).
import { lion } from '../../modules/achievements/lion.js';

document.getElementById('lion').append(lion(140));
