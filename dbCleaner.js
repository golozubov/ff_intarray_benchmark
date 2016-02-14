import {knex} from './db.js'

export class DbCleaner{
  static async clean(){
    const tableNames = [
      'feeds',
      'posts',
      'users'
    ]

    let promises = tableNames.map((name)=>{
      //knex(name).truncate()
      return knex.raw(`truncate ${name} restart identity cascade`)
    })

    await Promise.all(promises)
  }
}
