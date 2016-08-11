var dbString = dbString = 'postgres://app_ws:n0deApp@172.27.1.14:5432/test_icloset';;
if(process.env.DB_ENV == 'DEV')
  dbString = 'postgres://app_ws:n0deApp@172.27.1.14:5432/test_icloset';
else if(process.env.DB_ENV == 'STG')
  dbString = 'postgres://app_ws:app_icloset_app_ws@localhost:5432/staging_app';
else if(process.env.DB_ENV == 'PROD')
  dbString = 'postgres://app_ws:app_icloset_app_ws@localhost:5432/prod_app';

module.exports.conString = dbString ;
