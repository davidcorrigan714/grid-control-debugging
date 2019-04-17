const puppeteer = require('puppeteer');
var nodemailer = require('nodemailer');


var failsafe = setTimeout(errorEmail, 60000*15);

function errorEmail(){
	var transporter = nodemailer.createTransport({host: "devmail.natinst.com", port: 25});
  
	var mailOptions = {
		from: 'vsts-wiki-noreply@ni.com',
		to: 'david.corrigan@ni.com',
		subject: 'PMDM Update timed out',
		text: 'PMDM Update timed out'
	};

	transporter.sendMail(mailOptions, function(error, info){
	  if (error) {
			console.log(error);
			process.exit();
	  } else {
			console.log('Email sent: ' + info.response);
			process.exit();
	  }
	});
}

try {
	(async () => {
		const browser = await puppeteer.launch({headless: true});
		const page = await browser.newPage();

		page.on('console', async function (msg) {
			console.log('PAGE LOG:', msg.text());
			if (msg.text() == "All Saved")
			{
				await browser.close();
				clearTimeout(failsafe);
			}
		});

		page.authenticate({username: process.env.AZDO_USER_EMAIL ,password: process.env.AZDO_USER_PWD});

		console.log("Authenticating ...");
		await page.goto('https://sts2.natinst.com/adfs/ls/wia?wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline', { waitUntil: 'networkidle2' });
		
		console.log("Logging into Azure DevOps");
		await page.goto('https://nitest.visualstudio.com', { waitUntil:  'networkidle0' });

		console.log("Running the PMDM Update");
		await page.goto('https://nitest.visualstudio.com/DevCentral/_settings/davidcorrigan2.vsts-extensions-product-selector-dev.products-hub#doPMDMUpdate', { waitUntil:  'networkidle0' });
	})();
} catch (error) {
	var transporter = nodemailer.createTransport({host: "devmail.natinst.com", port: 25});
  
	var mailOptions = {
		from: 'vsts-wiki-noreply@ni.com',
		to: 'david.corrigan@ni.com',
		subject: 'PMDM Update ERROR',
		text: error
	};

	transporter.sendMail(mailOptions, function(error, info){
	  if (error) {
			console.log(error);
			process.exit();
	  } else {
			console.log('Email sent: ' + info.response);
			process.exit();
	  }
	});	
}