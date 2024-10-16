
import { Sequelize,Op } from 'sequelize';
import sequelize from '../config/database.js';
import { verifyPacketAndBan } from '../utils/securityUtils.js';
import { encrypt,generateKey } from '../helpers/encryption.js';
import PanelGM from '../models/gmPanelModel.js';
import UserGameInfo from '../models/userGameInfoModel.js';
import Banlist from '../models/banListModel.js';
import Cash from '../models/cashModel.js';
import TrackingPacket from '../models/trackingPacketModel.js';
import ItemInfo from '../models/itemInfoModel.js';
import Cupon from '../models/cuponesModel.js';
import InitialIpUser from '../models/ipUserModel.js';
import Streamer from '../models/streamersModel.js';
import LogStream from '../models/logStreamsModel.js';
import Linksgame from '../models/linksGameModel.js';
import Anuncio from '../models/anunciosModel.js';
import AssetPrice from '../models/assetsPriceModel.js';
import TypeAsset from '../models/typeAssetsModel.js';
import AnunciosComment from '../models/anunciosCommentModel.js';
import StreamPlatform from '../models/streamsPlatformsModel.js';
import puppeteer from 'puppeteer'; // Importa Puppeteer
import axios from 'axios';

const IMG_OFF = "https://res.cloudinary.com/dgh0ctded/image/upload/f_auto,q_auto/afbhaox5bxrydq17t8ik";

class WebService {
  
    async getLinks() {
        try {
            const links = await Linksgame.findAll({
                attributes: ['type','link','ref'],
                //raw: true,
                //transaction: t,
              });
      
          /**   CASE
              WHEN ci.lose = 0 AND ci.win = 0 THEN 1
              WHEN ci.lose = 0 AND ci.win > 0 THEN ci.win / 1
              WHEN ci.lose > 0 THEN ci.win / ci.lose
            END AS winrate*/
          return links;
        } catch (error) {
          console.error('Error al obtener los links:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getAnuncios() {
        try {
            const anuncios = await Anuncio.findAll({
                where:{
                  estado:1,
                },
                order: [
                  ['importante', 'DESC'], // Ordenar primero por el atributo 'importante', de mayor a menor
                  ['fecha', 'DESC'], // Luego, ordenar por fecha, del más reciente al más antiguo
                ],
              });

               // Obtener la fecha actual
            const fechaActual = new Date();
      
              // Recorrer cada anuncio para añadirle los comentarios
            const anunciosConComentarios = await Promise.all(
              anuncios.map(async (anuncio) => {
                // Obtener los comentarios del anuncio actual
                const comentarios = await AnunciosComment.findAll({
                  attributes:['apodo','comentario','fecha'],
                  where: {
                    anuncio: anuncio.id, // Filtrar por ID del anuncio
                  },
                  order: [
                    ['fecha', 'DESC'], // Ordenar los comentarios del más reciente al más antiguo
                  ],
                });
                 // Comprobar si la fecha de inicio del anuncio es dentro de la última semana
                const fechaAnuncio = new Date(anuncio.fecha); // Asegúrate de que la columna sea correcta
                const diferenciaTiempo = fechaActual - fechaAnuncio;
                const diasDiferencia = diferenciaTiempo / (1000 * 60 * 60 * 24); // Convertir milisegundos a días

                // Si el evento empezó hace menos de una semana, es "nuevo"
                const isNew = diasDiferencia <= 7;

                // Devolver el anuncio con los comentarios agregados
                return {
                  ...anuncio.toJSON(), // Convertir anuncio a JSON para poder agregar más datos
                  comentarios, // Agregar los comentarios al objeto del anuncio
                  isNew,
                };
              })
            );
        
            /**   CASE
                WHEN ci.lose = 0 AND ci.win = 0 THEN 1
                WHEN ci.lose = 0 AND ci.win > 0 THEN ci.win / 1
                WHEN ci.lose > 0 THEN ci.win / ci.lose
              END AS winrate*/
            return anunciosConComentarios;
        } catch (error) {
          console.error('Error al obtener los anuncios:', error);
          throw new Error('Error interno del servidor');
        }
      }

      async getBuyAssets() {
        try {
            const assetsPrices = await AssetPrice.findAll({
              attributes:['id','asset','multiple','price','currency','img'],
              where:{
                show: 1,
              }
            });
      
            // Recorrer cada assetPrice y buscar su tipo en TypeAsset
            const assetsWithTypes = await Promise.all(
              assetsPrices.map(async (assetPrice) => {
                // Buscar el tipo correspondiente en TypeAsset
                const typeAsset = await TypeAsset.findOne({
                  where: { id: assetPrice.asset },
                  attributes: ['tipo'], // Obtener solo el campo 'tipo'
                });

                // Agregar el tipo al resultado
                return {
                  ...assetPrice.toJSON(),
                  tipo: typeAsset ? typeAsset.tipo : 'Tipo no encontrado',
                };
              })
            );

          return assetsWithTypes;
        } catch (error) {
          console.error('Error al obtener los assets y precios:', error);
          throw new Error('Error interno del servidor');
        }
      }


      async getStreamers() {
        try {
             // Obtener todos los streamers
            const streamers = await Streamer.findAll({
              where:{
                status:1
              }
            });

            // Obtener los nombres de las plataformas
            const streamersWithPlatformNames = await Promise.all(
                streamers.map(async (streamer) => {
                    const platform = await StreamPlatform.findOne({
                        where: { id: streamer.platform },
                        attributes: ['name'],
                    });

                    let resTumb = '';
    
                    // Obtener el thumbnail según la plataforma
                    if (streamer.name) {
                        resTumb = await this.getThumbnailByPlatform(streamer);
                    }

                    return {
                        ...streamer.toJSON(),
                        platformName: platform ? platform.name : 'Plataforma desconocida',
                        thumbnail:resTumb.thumbnail,
                        live:resTumb.live,
                    };
                })
            );

          return streamersWithPlatformNames;
        } catch (error) {
          console.error('Error al obtener los streamers:', error);
          throw new Error('Error interno del servidor');
        }
      }

      // Función para obtener el thumbnail según la plataforma
    async getThumbnailByPlatform(streamer) {
      try {
          let thumbnail = '';

          switch (streamer.platform) {
            case 1:
                thumbnail = await this.getTikTokThumbnail(streamer.name);
                break;
            case 2:
                thumbnail = await this.getTwitchStreamerInfo(streamer.name);
                break;
            case 3:
                thumbnail = await this.getYouTubeLiveThumbnail(streamer.name);
                break;
            default:
                thumbnail = {
                  thumbnail:IMG_OFF,
                  live:false,
                };
          }

          return thumbnail;
      } catch (error) {
          console.error(`Error al obtener el thumbnail de ${streamer.platform}:`, error);
          return 'Error al obtener thumbnail';
      }
    }

    // Función para verificar si un usuario de TikTok está en vivo y obtener su imagen
    // async getTikTokThumbnail(username) {
    //   const url = `https://www.tiktok.com/@${username}`;
    //   const browser = await puppeteer.launch({ headless: true });
    //   const page = await browser.newPage();

    //   try {
    //     await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    //     // Verifica si el usuario está en vivo buscando el span con clase 'css-1n3ab5j-SpanLiveBadge'
    //     const isLive = await page.evaluate(() => {
    //       const avatarDiv = document.querySelector('[data-e2e="user-avatar"]');
    //       if (avatarDiv) {
    //         const liveBadge = avatarDiv.querySelector('span[class*="SpanLiveBadge"]');
    //         return liveBadge && liveBadge.textContent.includes('LIVE'); // Verifica si el span existe y contiene 'LIVE'
    //       }
    //       return false; // Si no se encuentra el contenedor, retorna false
    //     });

    //     if (isLive) {
    //       // Obtiene la imagen del usuario si está en vivo
    //       const imageUrl = await page.evaluate(() => {
    //         const avatarDiv = document.querySelector('[data-e2e="user-avatar"]');
    //         if (avatarDiv) {
    //           const avatarSpan = avatarDiv.querySelector('span[class*="SpanAvatarContainer"]'); // Busca el span que contenga 'SpanAvatarContainer'
    //           if (avatarSpan) {
    //             const img = avatarSpan.querySelector('img'); // Busca el <img> dentro del span
    //             return img ? img.src : null; // Retorna el src de la imagen o null si no existe
    //           }
    //         }
    //         return IMG_OFF; // Si no se encuentra el contenedor, retorna null
    //       });

    //       return imageUrl || IMG_OFF; // URL por defecto si no se encuentra la imagen
    //     } else {
    //       return IMG_OFF; // Si el usuario no está en vivo
    //     }
    //   } catch (error) {
    //     console.error('Error scraping TikTok:', error);
    //     return IMG_OFF; // Retorna un mensaje de error si ocurre un problema
    //   } finally {
    //     await browser.close(); // Cierra el navegador
    //   }
    // }

    async getTikTokThumbnail(username) {
      const options = {
        method: 'GET',
        url: 'https://tiktok-api23.p.rapidapi.com/api/user/info',
        params: {
          uniqueId: username
        },
        headers: {
          'x-rapidapi-key': '42768dc580msh74a20e0fc76b897p1457bajsne18fd7da8901', // Reemplaza con tu clave de API
          'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com'
        }
      };
    
      try {
        const response = await axios.request(options);
        
        if (response.data && response.data.userInfo && response.data.userInfo.user) {
          // Obtén la imagen del avatar de mayor tamaño
          const avatarUrl = response.data.userInfo.user.avatarLarger;
          const isLive = response.data.userInfo.user.roomId ? true : false;

          if(isLive){
            return {
              thumbnail:avatarUrl,
              live:true,
            };

          } else{
            return {
              thumbnail:IMG_OFF,
              live:false,
            };
          }
        } else {
          // Si no se encuentra información del usuario
          return {
            thumbnail:IMG_OFF,
            live:false,
          };
        }
    
      } catch (error) {
        console.error('Error obteniendo la imagen de TikTok:', error);
        return {
          thumbnail:IMG_OFF,
          live:false,
        };
      }
    }


  async getTwitchStreamerInfo(username) {
    try {

      const clientId = 'agg1heyyj5qg3dc1m25n8lgj7wuur4'; // Reemplaza con tu Client ID
      const clientSecret = 'iwg95vpc9jgfxi670a4xerxcjp1zt4'; // Reemplaza con tu Client Secret
      // Obtener el token de acceso
      const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
        },
      });
  
      const accessToken = tokenResponse.data.access_token;
  
      // Consultar la API de Twitch para verificar si el streamer está en vivo
      const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${username}`, {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${accessToken}`,
        },
      });
  
      if (response.data.data.length > 0) {
        // Streamer está en vivo
        const streamInfo = response.data.data[0];
        // return streamInfo.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'); // Ajusta el tamaño si es necesario
        return {
          thumbnail:streamInfo.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'),
          live:true,
        };
      } else {
        // Streamer no está en vivo
        return {
          thumbnail:IMG_OFF,
          live:false,
        };
        
        // 'https://static-cdn.jtvnw.net/ttv-boxart/0_IGG5Z7B6dC_1920x1080.jpg';  // Miniatura por defecto
      
      }
    } catch (error) {
      console.error('Error fetching streamer info:', error);
      return {
        thumbnail:IMG_OFF,
        live:false,
      };
      
      // 'https://static-cdn.jtvnw.net/ttv-boxart/0_IGG5Z7B6dC_1920x1080.jpg'; // Miniatura por defecto en caso de error
    }
  }

  async getYouTubeLiveThumbnail(username) {
    try {
      const apiKey = 'AIzaSyBsGSiHvcMJjK60wh98ioBGBw1EiV5OHf8'; // Reemplaza con tu API Key
      const channelId = await this.getChannelId(apiKey,username)
      const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&eventType=live&part=snippet&type=video`;
  
      const response = await axios.get(url);
      
      if (response.data.items.length > 0) {
        // Se encontró una transmisión en vivo
        const liveVideo = response.data.items[0];
        return {
          thumbnail:liveVideo.snippet.thumbnails.high.url,
          live:true,
        }; // Miniatura de la transmisión en vivo
      } else {
        // No hay transmisiones en vivo
        return {
          thumbnail:IMG_OFF,
          live:false,
        }; // Miniatura por defecto
      }
    } catch (error) {
      console.error('Error fetching YouTube live info:', error);
      return {
        thumbnail:IMG_OFF,
        live:false,
      }; // Miniatura por defecto en caso de error
    }
  }

  async getChannelId(apiKey, username) {
    const response = await axios.get(`https://www.googleapis.com/youtube/v3/channels`, {
      params: {
        part: 'id',
        forHandle: username,
        key: apiKey,
      },
    });
    // console.log(response);
  
    return response.data.items[0].id; // Esto te dará el Channel ID
  }
}

export default new WebService();