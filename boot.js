// console.log(ordersBook)

import { Telegraf, Markup, Scenes } from 'telegraf'
import { message } from 'telegraf/filters'
import { binance } from 'ccxt'
import { API } from '3commas-typescript'
import * as dotenv from 'dotenv'
// import WebSocket from 'ws'
dotenv.config()
const bot = new Telegraf(process.env.TELEGRAF_TOKEN)

const api = new API({
  key: process.env.PUBLIC_KEY, // Optional if only query endpoints with no security requirement
  secrets: process.env.PRIVATE_KEY, // Optional
  timeout: 60000, // Optional, in ms, default to 30000
  forcedMode: 'real' | 'paper',
  errorHandler: (response, reject) => {
    // Optional, Custom handler for 3Commas error
    const { error, error_description } = response
    reject(new Error(error_description ?? error))
  },
})

// const wsServer = new WebSocket.Server({ port: 9000 })
// wsServer.on('connection', onConnect)
// const ticker = await exchange.fetchTicker('BTC/USDT')
// const orders = await exchange.fetchOrderBook('TON/USDT', 20)
// const ordersBook = {
//   ASKS: orders.asks.reverse(),
//   BIDS: orders.bids,
// }

const getBotDeals = async () => {
  const deals = await api.getDeals()
  console.log(deals)

  const dealsMap = deals.map((el) => {
    return {
      id: el.id,
      bot_name: el.bot_name,
      pair: el.pair,
      status: el.deal_has_error
        ? 'Ошибка'
        : el.status === 'bought'
        ? 'Продажа'
        : 'Покупка',
      bought_average_price: +el.bought_average_price,
      bought_amount: el.bought_amount,
      bought_volume: el.bought_volume,
      to_currency: el.to_currency,
      from_currency: el.from_currency,
      created_at: el['finished?']
        ? 'Закрыта'
        : `${el.created_at.split('T')[0]} // ${
            el.created_at.split('T')[1].split('.')[0]
          }`,
      closed_at: el['finished?']
        ? `${el.created_at.split('T')[0]} // ${
            el.created_at.split('T')[1].split('.')[0]
          }`
        : 'Открыта',
      failed_message: el.failed_message ? el.failed_message : '',
    }
  })
  return await dealsMap
}
const getBotStats = async () => {
  const stats = await api.getBotsStats()
  return await stats
}

const menu = Markup.keyboard([
  ['Показать курс', 'Показать сделки', 'Статистика бота'],
]).resize(true)

bot.start((ctx) => {
  api.subscribeDeal((data) => {
    const parse_data = JSON.parse(data)
    const bot_message = parse_data?.message
    if (bot_message?.type === 'Deal') {
      console.log(bot_message)
      ctx.reply(
        `\u{1F4B0} BOT: ${bot_message.bot_name}\nID сделки: ${
          bot_message.id
        }\nПара: ${bot_message.pair}\n\u{1F4B2}\u{1F4B2} Профит: ${
          bot_message.usd_final_profit
        } USD\nТекущий статус: ${
          bot_message.localized_status === 'Активна'
            ? '\u{2705} Активна'
            : '\u{274C} Закрыта'
        }\nСоздана: ${bot_message.created_at?.split('T')[0]} // ${
          bot_message.created_at?.split('T')[1].split('.')[0]
        }\nЗакрыта: ${bot_message.closed_at?.split('T')[0]} // ${
          bot_message.closed_at?.split('T')[1].split('.')[0]
        }\nЦена покупки: ${bot_message.bought_average_price.substr(0, 6)} ${
          bot_message.from_currency
        }\nКуплено: ${bot_message.bought_amount} ${
          bot_message.to_currency
        }\nПотрачено: ${bot_message.bought_volume} ${
          bot_message.from_currency
        }\nСООБЩЕНИЯ БОТА:\n ${bot_message.bot_events.map(
          (el) =>
            `\n\n\u{2705} ${el.message} \n\u{231A} Дата: ${
              el.created_at.split('T')[0]
            } // ${el.created_at.split('T')[1].split('.')[0]}`
        )}`,
        menu
      )
    }
  })
})
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on(message('sticker'), (ctx) => ctx.reply('👍'))

bot.hears('Показать курс', async (ctx) => {
  try {
    const exchange = new binance()
    const orderbook = await exchange.fetchOrderBook('TWT/BUSD', 20)
    const bid = orderbook.bids.length ? orderbook.bids[0][0] : undefined
    const ask = orderbook.asks.length ? orderbook.asks[0][0] : undefined
    const spread = bid && ask ? ask - bid : undefined
    const date = new Date()
    ctx.reply(
      ` \u{1F4B0}${exchange.id.toUpperCase()} -> торговая пара -> TWT/BUSD\nТекущая дата: ${new Intl.DateTimeFormat().format(
        date
      )}\nТекущее время: ${`${date.getHours()}:${
        date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()
      }`}\n| Цена продажи -> ${ask.toFixed(
        4
      )} \u{1F4B2} \n| Цена покупки -> ${bid.toFixed(
        4
      )} \u{1F4B2} \n| Дельта -> ${spread.toFixed(4)} \u{1F4B2}`
    )
  } catch (e) {
    ctx.reply(` Something went wrong!`)
  }
})

bot.hears('Показать сделки', async (ctx) => {
  const botReply = await getBotDeals()

  botReply.forEach((el) => {
    if (el.status === 'Ошибка') {
      ctx.reply(
        `\u{274C} id: ${el.id}\nДата входа: ${el.created_at}\nДата выхода: ${el.closed_at} \n${el.failed_message}`
      )
      return
    }
    ctx.reply(`\u{2705} id: ${el.id}\nИмя бота: ${el.bot_name}\nПара: ${
      el.pair
    } \nТип: ${el.status} \nДата входа: ${el.created_at} \nДата выхода: ${
      el.closed_at
    } \nКуплено -> ${
      el.bought_amount + ` ${el.to_currency}`
    } по цене ${el.bought_average_price.toFixed(4)} ${
      el.from_currency
    } \nПотрачено -> ${el.bought_volume} ${el.from_currency}
    `)
  })
})
bot.hears('Статистика бота', async (ctx) => {
  const statistic = await getBotStats()
  console.log(statistic)

  ctx.reply(`\u{1F4B9} Статистика за все время: ${
    statistic.overall_stats.BUSD
  } \u{1F4B2}\n\u{1F4B9} Статистика за сегодня: ${
    statistic.today_stats.BUSD
  } \u{1F4B2}\n\nПрофит в USD: \nЗа все время -> ${statistic.profits_in_usd.overall_usd_profit.toFixed(
    4
  )} \u{1F4B2}\nЗа сегодня -> ${statistic.profits_in_usd.today_usd_profit.toFixed(
    4
  )} \u{1F4B2}\nПрофит в активных сделках -> ${statistic.profits_in_usd.active_deals_usd_profit.toFixed(
    4
  )} \u{1F4B2}\nСредств в активных сделках -> ${statistic.profits_in_usd.funds_locked_in_active_deals.toFixed(
    4
  )} \u{1F4B2}\n
    `)
})

bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
