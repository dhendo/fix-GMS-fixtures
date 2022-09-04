var stepped = 0, chunks = 0, rows = 0;
var start, end;
var parser;
var pauseChecked = false;
var printStepChecked = false;
var bareName = "";


$(function () {
    $('#submit-parse').click(function () {
        bareName = ($('#bareName').val() || "").toLowerCase();

        if (!bareName) {
            return alert("You must supply a club name");
        }

        stepped = 0;
        chunks = 0;
        rows = 0;
        var files = $('#files')[0].files;
        var config = buildConfig();


        if (files.length > 0) {
            if (!$('#stream').prop('checked') && !$('#chunk').prop('checked')) {
                for (var i = 0; i < files.length; i++) {
                    if (files[i].size > 1024 * 1024 * 10) {
                        alert("A file you've selected is larger than 10 MB; please choose to stream or chunk the input to prevent the browser from crashing.");
                        return;
                    }
                }
            }

            start = performance.now();

            $('#files').parse({
                config: config,
                before: function (file, inputElem) {
                    console.log("Parsing file:", file);
                },
                complete: function () {
                    console.log("Done with all files.");
                }
            });
        }
    });


});



function buildConfig() {
    return {
        delimiter: ",",
        newline: getLineEnding(),
        header: true,
        skipEmptyLines: true,
        dynamicTyping: $('#dynamicTyping').prop('checked'),
        preview: parseInt($('#preview').val() || 0),
        step: $('#stream').prop('checked') ? stepFn : undefined,
        encoding: $('#encoding').val(),
        worker: $('#worker').prop('checked'),
        comments: $('#comments').val(),
        complete: completeFn,
        error: errorFn,
        download: $('#download').prop('checked'),
        fastMode: $('#fastmode').prop('checked'),
        chunk: $('#chunk').prop('checked') ? chunkFn : undefined,
        beforeFirstChunk: undefined,
    };

    function getLineEnding() {
        if ($('#newline-n').is(':checked'))
            return "\n";
        else if ($('#newline-r').is(':checked'))
            return "\r";
        else if ($('#newline-rn').is(':checked'))
            return "\r\n";
        else
            return "";
    }
}

function stepFn(results, parserHandle) {
    stepped++;
    rows += results.data.length;

    parser = parserHandle;

    if (pauseChecked) {
        console.log(results, results.data[0]);
        parserHandle.pause();
        return;
    }

    if (printStepChecked)
        console.log(results, results.data[0]);
}

function chunkFn(results, streamer, file) {
    if (!results)
        return;
    chunks++;
    rows += results.data.length;

    parser = streamer;

    if (printStepChecked)
        console.log("Chunk data:", results.data.length, results);

    if (pauseChecked) {
        console.log("Pausing; " + results.data.length + " rows in chunk; file:", file);
        streamer.pause();
        return;
    }
}

function errorFn(error, file) {
    console.log("ERROR:", error, file);
}

function completeFn(results) {



    end = performance.now();
    if (!$('#stream').prop('checked')
        && !$('#chunk').prop('checked')
        && arguments[0]
        && arguments[0].data)
        rows = arguments[0].data.length;


    let items = [];
    for (var i = 0; i < results.data.length; i++) {

        let item = results.data[i];




        let homesplit = (item["Home team"] || "").split("(");
        item["Home team"] = homesplit[0];
        if (item["Home team"].includes("Pitch ")) {
            item["Home team"] = item["Home team"].split("Pitch ")[0];
        }

        if (homesplit.length > 1) {
            item["Venue"] = homesplit[1].replace(/\)/ig, "").replace("Venue:", "");
        } else {
            item["Venue"] = "";
        }

        // Teamo doesn't support ISO Date format!! Rearrange
        let splDate = item["Date"].split("-");
        item["Date"] = [splDate[2], splDate[1], splDate[0]].join("-");

        // The export has the event ID crammed in with the competition. TEamo import needs consistent values, so break them apart
        let compregex = RegExp(/(.*?)\s*?(\d*?)$/).exec(item["Competition/Event"]);
        if (compregex.length == 3) {
            item["Competition"] = compregex[1];
            item["Event"] = compregex[2];
        } else {
            item["Competition"] = item["Competition/Event"];
            item["Event"] = "";
        }


        // It's a lot easier to import via My Team / Opposition and Home/Away into Teamo
        if (item["Home team"].toLowerCase().includes(bareName)) {
            item["Home/Away"] = "H";
            item["My Team"] = item["Home team"];
            item["Opposition"] = item["Away team"];

        } else {
            item["Home/Away"] = "A"
            item["My Team"] = item["Away team"];
            item["Opposition"] = item["Home team"];
        }

        if (bareName && (item["My Team"]).toLowerCase() == bareName) {
            if (item["Competition"].includes("Women")) {
                item["My Team"] = item["My Team"] + " Women 1";
            } else {
                item["My Team"] = item["My Team"] + " Men 1";
            }
        }
        
        item["Time"] = (item["Time"] || "").trim();
        



        // If the top teams are missing a 1, add it on - this stops the teamo import being greedy and claiming all the other teams
        if (bareName && (item["My Team"]).toLowerCase() == (bareName + " men")) {
            item["My Team"] = item["My Team"] + " 1";
        }

        if (bareName && (item["My Team"]).toLowerCase() == (bareName + " women")) {
            item["My Team"] = item["My Team"] + " 1";
        }


        delete item["Home team"]
        delete item["Away team"]
        delete item["Notes"]
        delete item["Level"]
        delete item["Event"]
        delete item["App req"]
        delete item["Appointments"]
        delete item["Competition/Event"];
        delete item.__parsed_extra; // Some other junk from the export

        items.push(item);

    }


    const downloadxls = (data) => {
        let ws = XLSX.utils.json_to_sheet(data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "sheet");
        // let buf = XLSX.write(wb, {bookType:'xlsx', type:'buffer'}); // generate a nodejs buffer
        let str = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' }); // generate a binary string in web browser
        XLSX.writeFile(wb, `cleaned_fixtures.xlsx`);
    }

    downloadxls(items);
}
