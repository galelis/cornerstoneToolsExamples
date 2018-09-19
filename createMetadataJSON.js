const dicomParser = require('dicom-parser');
const fs = require('fs');
const config = require('./config.js');

function parseAndInsertFile(content, url) {
    return new Promise(function(resolve, reject) {
        const dataSet = dicomParser.parseDicom(content);

        const fileJSON = {};
        fileJSON['transactionId'] = 'img';
        fileJSON['fileDate'] = dataSet.string('x00080012');
        fileJSON['fileTime'] = dataSet.string('x00080013');
        fileJSON['studies'] = [];

        const study = {};
        study['studyInstanceUid'] = dataSet.string('x0020000d');
        study['studyDescription'] = dataSet.string('x00081030');
        study['studyDate'] = dataSet.string('x00080020');
        study['studyTime'] = dataSet.string('x00080030');
        study['patientName'] = dataSet.string('x00100010');
        study['patientAge'] = dataSet.string('x00101010');
        study['patientAllergies'] = dataSet.string('x00102110')
        study['patientBirthDate'] = dataSet.string('x00100030');
        study['patientId'] = dataSet.string('x00100020');
        study['patientSex'] = dataSet.string('x00100040');
        study['seriesList'] = [];

        const series = {};
        series['seriesDescription'] = dataSet.string('x0008103e');
        series['seriesInstanceUid'] = dataSet.string('x0020000e');
        series['seriesBodyPart'] = dataSet.string('x00180015');
        series['seriesNumber'] = dataSet.string('x00200011');
        series['seriesDate'] = dataSet.string('x00080021');
        series['seriesTime'] = dataSet.string('x00080031');
        series['seriesModality'] = dataSet.string('x00080060');
        series['instances'] = [];

        const instance = {};
        instance['columns'] = dataSet.uint16('x00280011');
        instance['rows'] = dataSet.uint16('x00280010');
        instance['instanceNumber'] = (dataSet.string('x00200013'));
        instance['acquisitionNumber'] = dataSet.string('x00200012');
        instance['photometricInterpretation'] = dataSet.string('x00280004');
        instance['bitAllocated'] = dataSet.uint16('x00280100');
        instance['bitsStored'] = dataSet.uint16('x00280101');
        instance['pixelRepresentation'] = dataSet.uint16('x00280103');
        instance['samplesPerPixel'] = dataSet.uint16('x00280002');
        instance['pixelSpacing'] = dataSet.string('x00280030');
        instance['highBit'] = dataSet.uint16('x00280102');
        instance['rescaleSlope'] = dataSet.string('x00281053');
        instance['rescaleIntercept'] = dataSet.string('x00281052');
        instance['imageOrientationPatient'] = dataSet.string('x00200037');
        instance['imagePositionPatient'] = dataSet.string('x00200032');
        instance['imageType'] = dataSet.string('x00080008');
        instance['sopInstanceUid'] = dataSet.string('x00080018');
        instance['numberOfFrames'] = dataSet.uint16('x00280008');
        instance['url'] = `${url}${instance['sopInstanceUid']}.dcm`;

        // /studies/${studyInstanceUid}/series/${seriesInstanceUid}/instances/${sopInstanceUid}/frames/${frameIndex}`

        series['instances'].push(instance);
        study['seriesList'].push(series);

        resolve(study);
    });
};

function addStudyIntoFile(inputStudy, finalJSON) {
    const inputSeries = inputStudy.seriesList[0];
    const inputInstance = inputSeries.instances[0];

    const studyIndex = finalJSON.studies.findIndex((study, i) => {
        return study.studyInstanceUid === inputStudy.studyInstanceUid;
    })

    if (studyIndex >= 0) {
        //estudo já existe
        const seriesIndex = finalJSON.studies[studyIndex].seriesList.findIndex((series, i) => {
            return series.seriesInstanceUid === inputSeries.seriesInstanceUid;
        });

        if (seriesIndex >= 0) {
            finalJSON.studies[studyIndex].seriesList[seriesIndex].instances.push(inputInstance);
        } else {
            finalJSON.studies[studyIndex].seriesList.push(inputSeries);
        }
    } else {
        finalJSON.studies.push(inputStudy);
    }
}

const testFolder = config.testFolder;
const url = `dicomweb://${config.dicomRepositoryUrl}${testFolder}`; 
const filename = config.filename;

const finalJSON = {
    studies: []
};

const promises = [];

fs.readdir(testFolder, (err, files) => {
    files.forEach(file => {
    	if (file === '.DS_Store' || file === 'study.json') {
    		return;
    	}

    	const promise = new Promise((resolve, reject) => {
	        fs.readFile(testFolder + file, (err, data) => {
	            if (err) {
	                reject(err);
	            }

                parseAndInsertFile(data, url).then(study => {
                    addStudyIntoFile(study, finalJSON);

                    resolve();
                }, reject);
            });
        });

        promises.push(promise);
    });

    Promise.all(promises).then(() => {
        const json = JSON.stringify(finalJSON, null, 2);
        fs.writeFile(filename, json, 'utf8', () => {
        	console.log('DONE!');
        });
    });
});