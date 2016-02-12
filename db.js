import config from './knexfile.js'
import knexjs from 'knex'

const env  = 'development'
export const knex = knexjs(config[env])

