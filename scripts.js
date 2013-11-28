      var sql="";

            // value is length for int, or list for enum
            var columnsParameters = {
                "id"        : { "type":"int","value":"11","autoincrement":"true","index":"primary key" },
                "int"       : { "type":"int","value":"11","autoincrement":"","index":"" },
                "enum"      : { "type":"enum","value":"'val1','val2'","autoincrement":"","index":""  },
                "date"      : { "type":"date","value":'',"autoincrement":"","index":""  },
                "bool"      : { "type":"tinyint","value":'1',"autoincrement":"","index":""  },
                "text"      : { "type":"text","value":'',"autoincrement":"","index":""  },
                "varchar"   : { "type":"varchar", "value":"100","autoincrement":"","index":""  },
                "timestamp" : { "type":"timestamp","value":'',"autoincrement":"","index":""  }
            }

            // first value is possible user value, 2nd value is mapping to a preset value defined in columnOptions
            var columnGuesses={
                // ints
                "id": "id",
                "pos": "int",
                "position":"int",
                "user_id":"int",
                // bools
                "is_active":"bool",
                "is_highlighted":"bool",
                "is_visible":"bool",
                // dates
                "date":"date",
                "dob":"date",
                "registration_date":"date",
                // varchars
                "name":"varchar",
                "email":"varchar",
                "title":"varchar",
                // texts
                "comments":"text",
                "comment":"text",
                "text":"text",
                //timestamp
                "timestamp":"timestamp",
                "registration":"timestamp"
            }

            // pass col name, it guesses type and then additionl params
            function predictType(columnName){
                var columnName=columnName.toLowerCase();
                var columnType ;

                // if could guess it
                if(columnGuesses[columnName]) { columnType = columnGuesses[columnName]; }
                // otherwise default to varchar
                else { columnType = 'varchar' }

                // get guessed column type parameters
                if(columnsParameters[columnType]) {
                    columnParameters = columnsParameters[columnType];
                }

                var column = {};
                column['type'] = columnType ;
                column['parameters'] = columnParameters ;
                return column;
            }



            // cleans a string
            function string_to_slug(str) {
                str = str.replace(/^\s+|\s+$/g, ''); // trim
                str = str.toLowerCase();

                // remove accents, swap ñ for n, etc
                var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
                var to   = "aaaaeeeeiiiioooouuuunc------";
                for (var i=0, l=from.length ; i<l ; i++) {
                    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
                }

                str = str.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
                .replace(/\s+/g, '_') // collapse whitespace and replace by -
                .replace(/-+/g, '_'); // collapse dashes

                return str;
            }


            var dataArray = {
                tables: []
            };

            // does all the work
            function process(e,data){
                var i,j,name,predictedTablesHtml="";
                var tables=data.split(/\r\n|\r|\n/g); // split each table set
                var columns=[];

                dataArray = {
                    tables: []
                };

                for(i=0;i<tables.length;i++){ // i is the table count
                    name=tables[i].split(":"); 
                    tableName = string_to_slug(name[0]);

                    var tableData = {
                        table_name : tableName,
                        id         : i,
                        columns: []
                    };

                    predictedTablesHtml+="<section data-table-id='"+ i +"'><div rel='table' id='t"+i+"' data-table-id='"+ i +"' class='tag table'>"+tableName+"</div>";
                    if(name[1]){ // if entries found after :
                        columns=name[1].split(","); // split column names
                        for(j=0;j<columns.length;j++){ // j is the column count
                            columnName = string_to_slug(columns[j]); // remove all white spaces and replace special chars
                            columnType = predictType(columnName);

                            var columnData = {
                                column_name : columnName,
                                id          : 'c'+i+j,
                                properties: []
                            }

                            columnData.properties['type'] = columnType.parameters.type ;
                            columnData.properties['value'] = columnType.parameters.value ;
                            columnData.properties['autoincrement'] = columnType.parameters.autoincrement;
                            columnData.properties['index'] = columnType.parameters.index ;
                            columnData.properties['id'] =  "p"+i+j;

                            tableData.columns.push(columnData);

                            // what's the col type (int, varchar, etc.)
                            var columnParams = "<span id='c"+i+j+"'class='columnType editableTypes'>" + columnType.parameters.type + "</span>";
                            // what's the col parameter value ( varchr->255, enum vals..)
                            if (columnType.parameters.value) {
                                columnParams += "<span id='p"+i+j+"' class='columnParameters editable'>"+columnType.parameters.value+"</span>";
                            }


                            predictedTablesHtml+="\
                            <div rel='column' data-column-id='"+ j +"'>\
                            <div class='tag column'>" + columnName + "</div>\
                            <div class='tag column_type'>" + columnParams + "</div>\
                            </div>";
                        }
                        predictedTablesHtml += "</section>";//close table
                    }
                    dataArray.tables.push(tableData);
                }
                $("#visualData").html(predictedTablesHtml);
                convertToSql();

                initEditables(); // reinitialize editable fields
            }

            function convertToSql(){
                var sql = '';
                $.each(dataArray.tables, function(tableIndex, table){
                    sql += "CREATE TABLE IF NOT EXISTS `" + table.table_name + "` (\n";

                    if (table.columns){
                        var indexes = '';
                        $.each(table.columns, function(columnIndex,column){
                            var autoIncrement = colValue = '';
                            if (column.properties.autoincrement == 'true') {
                                autoIncrement = "auto_increment";
                            }
                            if (column.properties.value) {
                                colValue = "(" + column.properties.value + ")";
                            }
                            if (column.properties.index) { // params for ex: varchar(255) or enum(...)
                                indexes += "\t " + column.properties.index + "(`" + column.column_name + "`)"; 
                            }

                            sql += "\t`"+column.column_name+"` " + column.properties.type + colValue +" NOT NULL " + autoIncrement + ",\n"; // autoincrement, index, type, value
                        });
                        sql += indexes;
                    }

                    sql += "\n) ENGINE=MyISAM  DEFAULT CHARSET=utf8 ;\n\n";

                });

                $("#sql").html('');
                $("#sql").html(sql);
                $("#sqlTextarea").html(sql);
                $('#sql').each(function(i, e) {hljs.highlightBlock(e)});
            }


            function updateTextBox(){
                var text = '';
                $.each(dataArray.tables, function(tableIndex, table){
                    text += table.table_name + ": ";

                    if (table.columns){
                        $.each(table.columns, function(columnIndex,column){
                            text += column.column_name+",";
                        });
                    }

                    text += "\n";

                });

                $("#txt").val(text);
            }



            // check if parameter of selected col type are correct
            function validateColumnTypeParameters(columnType, parametersElement, columnElement, numberOfColumnDetails){
                // check for predifined col type
                // if exists, get its default val/value
                if (columnsParameters[columnType]) {
                    if (columnsParameters[columnType].value) {
                        // update previous value
                        if (numberOfColumnDetails == 2) { // 2 = col type + params, 1 = only col type exists
                            parametersElement.html(columnsParameters[columnType].value);
                        }
                        // add back params element if it doesnt exist
                        else {
                            columnElement.append("<span class='columnParameters editable'>"+columnsParameters[columnType].value+"</span>");
                        }
                        // remove params if not exist
                    }else {
                        $(parametersElement).remove();
                    }

                    // update object
                    var tableId = columnElement.parent().parent().attr('data-table-id');
                    var colId = columnElement.parent().attr('data-column-id');
                    updateParameterById('p' + tableId + colId,columnType);
                } 
                // type doesnt exist
                else {
                    alert("Invalid column type"); 
                }
            }

            // reinitalize editables
            function initEditables(){
                $('.editable').editable(function(value, settings) { 
                    var tableId = $(this).parent().parent().parent().attr('data-table-id');
                    var colId = $(this).parent().parent().attr('data-column-id');
                    updateParameterPropertyById('p' + tableId + colId,value);
                    convertToSql();
                    return(value);
                    }, {
                        type    : 'text'
                    }
                );

                $('.editableTypes').editable(function(value, settings) { 
                    var children = $(this).parent().children().length;
                    validateColumnTypeParameters(value, $(this).parent().children('.columnParameters'), $(this).parent(), children);
                    convertToSql();
                    return(value);
                    }, {
                        type   : 'select',
                        data   : {'varchar':'varchar','enum':'enum','date':'date','text':'text','boolean':'boolean','int':'int'},
                        onblur : 'submit'
                    }
                );
            }


            function updateParameterById(id, columnType) {
                $.each(dataArray.tables, function(tableIndex, table){
                    if (table.columns){
                        $.each(table.columns, function(columnIndex,column){
                            if (column.properties) {
                                if (column.properties.id == id) {
                                    column.properties['type']           = (columnsParameters[columnType].type) ? columnsParameters[columnType].type : undefined;
                                    column.properties['value']         = (columnsParameters[columnType].value) ? columnsParameters[columnType].value : undefined;
                                    column.properties['autoincrement'] = (columnsParameters[columnType].autoincrement) ? columnsParameters[columnType].autoincrement: undefined;
                                    column.properties['index']          = (columnsParameters[columnType].index) ? columnsParameters[columnType].index: undefined;
                                }
                                else {
                                    return null; // The object was not found
                                }
                            }
                        });
                    }
                });
            }
            function updateParameterPropertyById(id,value) {
                $.each(dataArray.tables, function(tableIndex, table){
                    if (table.columns){
                        $.each(table.columns, function(columnIndex,column){
                            if (column.properties) {
                                if (column.properties.id == id) {
                                    column.properties['value']  = value;
                                }
                                else {
                                    return null; // The object was not found
                                }
                            }
                        });
                    }
                });
            }



            $(document).ready(function(){
                initEditables();
                process(null,$("#txt").val() );

                $("#txt").keyup(function(e){
                    process(event,this.value);
                });

            });