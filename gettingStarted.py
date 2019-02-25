from flask import Flask
from flask_cors import CORS
from flask import request
from datetime import datetime
import requests
import urllib
import xml
import xml.etree.ElementTree as ET
from urllib.parse import urlencode
from urllib.error import URLError, HTTPError
import json
import re

app = Flask(__name__)
CORS(app)

apiKey = "4cf9eaa4-dd31-4365-a3d4-33a8b526b545"
pmdmURL = "http://immix-backend.natinst.com/pmdm/odata/2/"

# Double escape requests to avoid Apache catching forward slashes as part of the path
@app.route('/pmdmsoftwareproduct')
def pmdmsoftwareproduct():
	#product = urllib.parse.unquote(product)
	product = request.args.get('product')
	# TODO: Error check the request
	product = product.replace("'", "''")
	urlAddress = pmdmURL+'/SoftwareEditionVersionAgnosticMappings?%24filter=productName%20eq%20%27'+urllib.parse.quote_plus(product,safe='')+'%27&ni-api-key=' + apiKey
	req = urllib.request.Request(urlAddress)
	response = urllib.request.urlopen(req, timeout = 2)
	data = response.read()
	encoding = response.info().get_content_charset('utf-8')
	returnData = data.decode(encoding)
	xmlNode = ET.fromstring(returnData)
	
	if not 'feed' in xmlNode.tag:
		return "ERROR: Feed tag not found"
	
	returnNodes = []
	
	for child in xmlNode:
		if 'entry' in child.tag:
			newEntry = {} # TODO Initialize fields to blank
			for node in child:
				if 'id' in node.tag:
					newEntry['id'] = node.text
				if 'content' in node.tag:
					for node2 in node[0]:
						if 'editionType' in node2.tag:
							newEntry['editionType'] = node2.text
						if 'nvaFirstAvailableDate' in node2.tag:
							newEntry['firstAvailable'] = node2.text
							if newEntry['firstAvailable'] is None:
								newEntry['firstAvailable'] = "1980-01-01"
							else:
								newEntry['firstAvailable'] = newEntry['firstAvailable'][0:10]
						if 'nvaMarketingVersion' in node2.tag:
							newEntry['nvaMarketingVersion'] = node2.text
						if 'productName' in node2.tag:
							newEntry['productName'] = node2.text
			returnNodes.append(newEntry)
	
	softwareTree = {
		'text':product,
		'children':[],
		'imported':True,
		'source':'pmdm',
		'key':product
	}
	
	uniqueVersions = []
	
	# Find all the product versions
	for product in returnNodes:
		if not product['nvaMarketingVersion'] in uniqueVersions:
			uniqueVersions.append(product['nvaMarketingVersion'])
	
	# Add the products to the version categories
	for version in uniqueVersions:
		softwareTree['children'].append({'text':version,'children':[]})
	
	# filter out duplicates in the version editions
	for version in softwareTree['children']:
		for entry in returnNodes:
			if version['text'] in entry['nvaMarketingVersion']:
				contains = False
				for item in version['children']:
					if item['text'] in entry['editionType']:
						contains = True
				if not contains:
					version['children'].append({'text':entry['editionType'],'children':[],'firstAvailable':entry['firstAvailable']})

	# Attach a year at the version level
	for version in softwareTree['children']:
		latestTime = "1970-01-01"
		for edition in version['children']:
			thisTime = datetime.strptime(edition['firstAvailable'],"%Y-%m-%d").timestamp()
			if thisTime > datetime.strptime(latestTime,"%Y-%m-%d").timestamp():
				latestTime = edition['firstAvailable']
		version["firstAvailable"] = latestTime
		
	# Sort the versions
	softwareTree['children'].sort(key=lambda k: (k['firstAvailable'], k['text']), reverse=True)

	return json.dumps(softwareTree)


@app.route('/pmdmsoftwareproducts')
def pmdmsoftwareproducts():
	# TODO: Error check the request
	urlAddress = pmdmURL+'/Products?%24filter=productType%20eq%20%27Software%27&ni-api-key=' + apiKey
	req = urllib.request.Request(urlAddress)
	response = urllib.request.urlopen(req, timeout = 2)
	data = response.read()
	encoding = response.info().get_content_charset('utf-8')
	returnData = data.decode(encoding)
	xmlNode = ET.fromstring(returnData)
	
	if not 'feed' in xmlNode.tag:
		return "ERROR: Feed tag not found"
	returnNames = []
	
	for child in xmlNode:
		if 'entry' in child.tag:
			newEntry = {}
			for node in child:
				if 'content' in node.tag:
					for node2 in node[0]:
						if 'name' in node2.tag:
							returnNames.append(node2.text)
	return json.dumps(returnNames)


@app.route('/pmdmhardwareproducts')
def pmdmhardwareproducts():
	# TODO: Error check the request
	urlAddress = pmdmURL+'/Products?%24filter=productType%20eq%20%27Hardware%27&ni-api-key=' + apiKey
	req = urllib.request.Request(urlAddress)
	response = urllib.request.urlopen(req, timeout = 2)
	data = response.read()
	encoding = response.info().get_content_charset('utf-8')
	returnData = data.decode(encoding)
	xmlNode = ET.fromstring(returnData)
	
	if not 'feed' in xmlNode.tag:
		return "ERROR: Feed tag not found"
	returnNames = []
	
	for child in xmlNode:
		if 'entry' in child.tag:
			newEntry = {}
			for node in child:
				if 'content' in node.tag:
					for node2 in node[0]:
						if 'name' in node2.tag:
							returnNames.append(node2.text)
	return json.dumps(returnNames)
	

@app.route('/devSetDoc')
def setDoc():
	doc = request.args.get('doc')
	contents = request.args.get('contents')
	
	doc = re.sub('[\\\\]', '', doc)
	doc = re.sub('[/]', '', doc)
	
	f = open("docs/"+doc, "w+")
	f.write(contents)
	
	return ""
	
	
@app.route('/devGetDoc')
def getDoc():
	doc = request.args.get('doc')
	
	doc = re.sub('[\\\\]', '', doc)
	doc = re.sub('[/]', '', doc)
	
	with open("docs/"+doc, 'r') as myfile:
		return myfile.read()
	
	return ""

if __name__ == "__main__":
	context = ( 'cert/natinst.cert', 'cert/natinst.key')
	app.run(host='0.0.0.0', port=8443, ssl_context=context, threaded=True, debug=True)
