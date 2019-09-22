const logger = require('loglevel');

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const async = require('async');

const definedError = require('./defined-error');

const dryRun = false;	// if true, don't actually run sqlStatements

let templateDb = null;
let workingDb = null;

function runSync(templateDBPath, workingDBPath, { doCreateTables, doCreateColumns, doCopyContent }, callback) {
	logger.debug('Syncing DB...');

	logger.debug('Template DB Path:', templateDBPath);
	logger.debug('Working DB Path :', workingDBPath);

	if (!fs.existsSync(templateDBPath)) {
		return callback(definedError.create('templateDBPath not found: ' + templateDBPath, null, 'SYNCERR', null));
	}
	if (!fs.existsSync(workingDBPath)) {
		return callback(definedError.create('workingDBPath not found: ' + workingDBPath, null, 'SYNCWARN', null));
	}

	templateDb = new sqlite3.Database(templateDBPath, (err) => {
		if (err) {
			return callback(err);
		}

		workingDb = new sqlite3.Database(workingDBPath, (err2) => {
			if (err2) {
				return callback(err);
			}

			syncTables(doCreateTables, (err) => {
				logger.log('syncTables done');
				
				if (err) {
					logger.log(err);
					return callback(err);
				}

				syncColumns(doCreateColumns, (err) => {
					if (err) {
						logger.log(err);
						return callback(err);
					}

					syncContent(doCopyContent, (err) => {
						if (err) {
							logger.log(err);
						}

						return callback(err);
					});
				});
			});
		});
	});
}

export {
	runSync
}

function runQuery({ db, query, params }, callback) {
	// logger.debug('runQuery START');
	if (!query) {
		// logger.debug('  query is null, aborting');
		return callback(null);
	}

	if (dryRun) {
		logger.debug('  SQL Query suppressed due to dryRun:', query);
		return callback(null);
	}

	logger.debug('  running query ...')
	db.run(query, params, (err) => {
		if (err) {
			logger.debug('  error: ', err);
			logger.debug('  the query was: ', query);
		} else {
			logger.debug('  OK');
		}
		callback(err);
	});
}

function syncTables(doCreateTables, callback) {
	if (!doCreateTables) {
		logger.debug('skipping syncTables due to configuration');
		return callback(null);
	}

	logger.debug('syncTables start');

	templateDb.all(`select tbl_name, sql from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, rowsTemplate) => {
		logger.debug('  got result');

		if (err) {
			logger.log(definedError.create('error in query', {err}));
			return callback(err);
		}

		// logger.debug('rowsTemplate:', rowsTemplate);

		workingDb.all(`select tbl_name from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, rowsWorking) => {
			if (err) {
				return callback(err);
			}

			// logger.debug('rowsWorking:', rowsWorking);

			let sqlStatements = [{ db: workingDb, query: null, params: [] }];	// we always include a null-statement in order to at least call the creation routine one time

			rowsTemplate.forEach(rowTemplate => {
				if (!rowsWorking.find(rowWorking => {
					return rowWorking['tbl_name'] === rowTemplate['tbl_name'];
				})) {
					sqlStatements.push({
						db: workingDb,
						query: rowTemplate['sql'],
						params: []
					});
				}
			});

			logger.debug('  found ' + (sqlStatements.length - 1) + ' new tables');

			async.mapSeries(sqlStatements, runQuery, (err) => {
				return callback(err);
			});
		});
	});
}

function syncColumns(doCreateColumns, callback) {
	if (!doCreateColumns) {
		logger.debug('skipping syncColumns due to configuration');
		return callback(null);
	}

	logger.debug('syncColumns start');

	templateDb.all(`select tbl_name from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, rowsTemplate) => {
		if (err) {
			logger.debug('err:', err);
			return callback(err);
		}

		// logger.debug('rowsTemplate:', rowsTemplate);

		workingDb.all(`select tbl_name from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, rowsWorking) => {
			if (err) {
				return callback(err);
			}

			// logger.debug('rowsWorking:', rowsWorking);

			let analyzeTables = [null];	// we always include a null-statement in order to at least call the routine one time

			rowsTemplate.forEach(rowTemplate => {
				if (rowsWorking.find(rowWorking => {
					return rowWorking['tbl_name'] === rowTemplate['tbl_name'];
				})) {
					analyzeTables.push(rowTemplate['tbl_name']);
				}
			});

			logger.debug('  analyzing ' + (analyzeTables.length - 1) + ' tables');

			async.mapSeries(analyzeTables, syncColumnsTable, (err) => {
				return callback(err);
			});
		});
	});
}

function syncColumnsTable(table, callback) {
	if (!table) {
		return callback(null);
	}

	logger.debug('  analyzing table ' + table);

	templateDb.all(`pragma table_info(${table})`, [], (err, colsTemplate) => {
		if (err) {
			logger.debug('err:', err);
			return callback(err);
		}

		// logger.debug('    colsTemplate:', colsTemplate);

		workingDb.all(`pragma table_info(${table})`, [], (err, colsWorking) => {
			if (err) {
				return callback(err);
			}

			// logger.debug('    colsWorking:', colsWorking);

			let sqlStatements = [{ db: workingDb, query: null, params: [] }];
			let numMissingCols = 0;

			colsTemplate.forEach(colTemplate => {
				if (colsWorking.find(colWorking => {
					return colTemplate.name === colWorking.name;
				})) {
					return;
				}

				logger.debug('  found missing column:', colTemplate.name);
				numMissingCols++;

				sqlStatements.push({
					db: workingDb,
					query: 'ALTER TABLE [' + table + '] ADD COLUMN [' + colTemplate.name + '] ' + colTemplate.type + (colTemplate.notnull ? ' NOT NULL' : '') + (colTemplate['dflt_value'] !== null ? ' DEFAULT ' + colTemplate['dflt_value'] : ''),
					params: []
				});
			});

			logger.debug('  found ' + numMissingCols + ' missing column/s');

			async.mapSeries(sqlStatements, runQuery, (err) => {
				return callback(err);
			})
		});
	});
}

function syncContent(doCopyContent, callback) {
	if (!doCopyContent) {
		logger.debug('skipping syncContent due to configuration');
		return callback(null);
	}

	logger.debug('syncContent start');

	let tablesToAnalyze = [null];

	templateDb.all(`select tbl_name from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, tablesTemplate) => {
		if (err) {
			logger.debug('err:', err);
			return callback(err);
		}
		workingDb.all(`select tbl_name from sqlite_master WHERE type='table' AND name not like 'sqlite%' AND name not like 'xtb_Database_Properties'`, [], (err, tablesWorking) => {
			if (err) {
				return callback(err);
			}

			// logger.debug('tablesTemplate:', tablesTemplate);
			// logger.debug('tablesWorking:', tablesWorking);

			tablesTemplate.forEach(tableTemplate => {
				if (tablesWorking.find(tableWorking => {
					return tableTemplate['tbl_name'] === tableWorking['tbl_name'];
				})) {
					// logger.debug('  table ' + tableTemplate['tbl_name'] + ' found');
					tablesToAnalyze.push(tableTemplate['tbl_name']);
				}
			});

			async.mapSeries(tablesToAnalyze, syncContentTable, (err) => {
				return callback(err);
			});
		});
	});
}

function syncContentTable(tableName, callback) {
	if (!tableName) {
		return callback(null);
	}

	logger.debug('  analyzing table ' + tableName);

	// Fetch content in TemplateDB
	templateDb.all(`SELECT * FROM [${tableName}]`, [], (err, contentTemplate) => {
		if (err) {
			logger.debug('  ERROR:', err);
			return callback(err);
		}

		if (contentTemplate.length === 0) {
			return callback(null);
		}

		templateDb.all(`pragma table_info(${tableName})`, [], (err, colsTemplate) => {
			if (err) {
				logger.debug('  ERROR:', err);
				return callback(err);
			}

			workingDb.all(`pragma table_info(${tableName})`, [], (err, colsWorking) => {
				if (err) {
					logger.debug('  ERROR:', err);
					return callback(err);
				}

				let numPK = 0;
				let pkColumnName = '';

				colsTemplate.forEach(colTemplate => {
					if (colTemplate.pk === 1) {
						numPK++;
						pkColumnName = colTemplate.name;
					}
				});

				if (numPK === 0) {
					logger.debug('    ERROR: no PK column found!');
					return callback({error: 'no PK column found!'});
				}

				if (numPK > 1) {
					logger.debug('    ERROR: multiple PK columns found!');
					return callback({error: 'multiple PK columns found!'});
				}

				logger.debug('    PK column name:', pkColumnName);

				if (!colsWorking.find(colWorking => {
					return colWorking.name === pkColumnName;
				})) {
					logger.debug('    ERROR: PK column not found in working DB');
					return callback({error: 'PK column not found in working DB'});
				}

				const colsToAnalyze = [];
				colsTemplate.forEach(colTemplate => {
					if (colsWorking.find(colWorking => {
						return colWorking.name === colTemplate.name;
					})) {
						colsToAnalyze.push(colTemplate.name);
					}
				});

				contentTemplate.forEach(content => {
					content._colsToAnalyze = colsToAnalyze;
					content._tableName = tableName;
					content._pkColumnName = pkColumnName
				});

				async.mapSeries(contentTemplate, syncContentTableRow, (err) => {
						return callback(err);
				});
			});
		});
	});
}

function syncContentTableRow(content, callback) {
	// logger.debug('syncing content table row:', content);

	const query = `SELECT COUNT(1) AS count FROM [${content._tableName}] WHERE ${content._pkColumnName} = ${content[content._pkColumnName]}`
	workingDb.get(query, [], (err, row) => {
		if (err) {
			return callback(err);
		}
		
		let statement = null;
		let params = {};
		
		if (row.count === 0) {
			// Create INSERT statement
			logger.debug('    INSERT');

			let insertStatement = `INSERT INTO [${content._tableName}] `;
			let colNames = '';
			let colValues = '';

			content._colsToAnalyze.forEach(col => {
				colNames = colNames + (colNames ? ', ' : '') + '[' + col + ']';
				colValues = colValues + (colValues ? ', ' : '') + '$' + col;
				params['$' + col] = content[col];
			});

			statement = insertStatement + '(' + colNames + ') VALUES (' + colValues + ')';
		}

		if (row.count === 1) {
			// Create UPDATE statement
			// logger.debug('    UPDATE');

			let updateStatement = `UPDATE [${content._tableName}] SET `;
			
			let columns = '';
			
			content._colsToAnalyze.forEach(col => {
				if (col === content._pkColumnName) {
					return;	// skip the primary key column
				}
				
				columns = columns + (columns ? ', ' : '') + '[' + col + '] = $' + col;
				params['$' + col] = content[col];
			});

			statement = updateStatement + columns + ' WHERE [' + content._pkColumnName + '] = $' + content._pkColumnName;
			params['$' + content._pkColumnName] = content[content._pkColumnName];
		}

		// logger.debug('statement:', statement);
		workingDb.run(statement, params, (err) => {
			if (err) {
				logger.debug('      ERROR:', err);
				logger.debug('      Statement was:', statement);
				logger.debug('      Params were:', params);
			} else {
				// logger.debug('      OK');
			}

			return callback();
		})
	});
}