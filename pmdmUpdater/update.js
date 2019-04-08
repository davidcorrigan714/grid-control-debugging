const puppeteer = require('puppeteer');
const util = require('util');
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

function waitForFrame(page) {
  let fulfill;
  const promise = new Promise(x => fulfill = x);
  checkFrame();
  return promise;

  function checkFrame() {
    const frame = page.frames().find(f => f.url().includes('productshub.html'));
    if (frame)
      fulfill(frame);
    else
      page.once('frameattached', checkFrame);
  }
}

async function waitForStatus(f, status) {
	while( await f.$eval('#puppeteer-status', el => el.innerText) != status)
	{
		// busy waits are so much fun
	}
}

try {
	(async () => {
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		page.setViewport({width:1920,height:1080});

		page.on('request', request => {
			//console.log(request._method + " " + request._url);
		});

		page.on('console', msg => console.log('PAGE LOG:', msg.text()));

		page.authenticate({username: process.env.AZDO_USER_EMAIL ,password: process.env.AZDO_USER_PWD});

		console.log("Authenticating ...");

		await page.goto('https://sts2.natinst.com/adfs/ls/wia?wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline', { waitUntil: 'networkidle2' });
		
		console.log("Loading the products hub ...");
		
		await page.goto('https://nitest.visualstudio.com/DevCentral/_settings/davidcorrigan2.vsts-extensions-product-selector-dev.products-hub', { waitUntil:  'networkidle0' });
		
		console.log("Finding the frame");	
		let f = await waitForFrame(page);
		
		console.log("Got the frame, waiting for it to populate");
		await f.waitForSelector('#puppeteer-status');
		
		await f.$eval("#puppeteer-status", b => b.removeAttribute("hidden"));
		await f.$eval("#updatePMDM", b => b.removeAttribute("hidden"));
		await f.$eval("#save", b => b.removeAttribute("hidden"));
		await page.waitFor(5000); // Wait for the modal to disappear
		
		console.log("Waiting for products to load");
		waitForStatus(f, "Loaded");
		
		console.log("Updating products from PMDM");
		await f.click('#updatePMDM');
		await waitForStatus(f, "PMDM Updated");
		await page.waitFor(4000); // Wait for the modal to disappear
		
		console.log("Saving");
		await f.click('#save');
		await waitForStatus(f, "All saved");

		await browser.close();
		
		clearTimeout(failsafe);
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