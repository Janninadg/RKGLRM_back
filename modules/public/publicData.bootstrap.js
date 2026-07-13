import WebService from '../../services/webService.js';
import EventService from '../../services/eventService.js';
import UserService from '../../services/userService.js';
import MarketService from '../../services/marketService.js';
import ForumService from '../../services/forumService.js';

const PUBLIC_DATA_LOADERS = [
  ['links', () => WebService.getLinks()],
  ['stages', () => WebService.getStages()],
  ['anuncios', () => WebService.getAnuncios()],
  ['assets', () => WebService.getBuyAssets()],
  ['streamers', () => WebService.getStreamers()],
  ['resumen home', () => WebService.getHomeSummary()],
  ['eventos', () => EventService.obtenerTodos()],
  ['preguntas de seguridad', () => UserService.getSecurityQuestions()],
  ['ranking personajes', () => UserService.getRanking()],
  ['ranking clanes', () => UserService.getRankingClanes()],
  ['metodos de pago', () => MarketService.getPayments()],
  ['categorias del foro', () => ForumService.getAllCategories()],
  ['ultimos posts', () => ForumService.getLatestPosts(10)],
  ['posts por categoria', () => ForumService.getLatestPostsByCategory(2, 5)],
];

export async function bootstrapPublicDataCache() {
  console.log('[PublicDATA] precargando datos publicos...');

  for (const [label, loader] of PUBLIC_DATA_LOADERS) {
    try {
      await loader();
    } catch (error) {
      console.error(`[PublicDATA] error cargando ${label}:`, error.message);
    }
  }
}

export const initPublicDataCache = bootstrapPublicDataCache;
