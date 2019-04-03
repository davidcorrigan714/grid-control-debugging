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

# This file will live on an apache server somewhere, needs some cleanup and the API file should be in a config.
# Also should get it containerized for deployment

apiKey = "3e1950b0-1e9b-48e9-a145-92bbab30f6b2"

pmdmURL = "http://immix-dev.natinst.com/pmdm/odata/2/" # Dev
#pmdmURL = "http://immix-test.natinst.com/pmdm/odata/2/" # Test
#pmdmURL = "http://immix.natinst.com/pmdm/odata/2/"  # Production

def pmdmRequest(req):
	urlAddress = pmdmURL+req+"ni-api-key=" + apiKey
	req = urllib.request.Request(urlAddress)
	response = urllib.request.urlopen(req, timeout = 2)
	data = response.read()
	encoding = response.info().get_content_charset('utf-8')
	return ET.fromstring(data.decode(encoding))

@app.route('/pmdmsoftwareproduct')
def pmdmsoftwareproduct():
	product = request.args.get('productId')
	# TODO: Sanity check the request and productId
	
	# Get the product name
	xmlNode = pmdmRequest("/Products('"+product+"')?")
	
	productName = ''

	if not 'entry' in xmlNode.tag:
		return "ERROR: entry tag not found"

	newEntry = {} # TODO Initialize fields to blank
	for node in xmlNode:
		if 'id' in node.tag:
			newEntry['id'] = node.text
		if 'content' in node.tag:
			for node2 in node[0]:
				if 'name' in node2.tag:
					productName = node2.text

	xmlNode = pmdmRequest('/SoftwareEditionVersionAgnosticMappings?%24filter=productId%20eq%20%27'+product+'%27&')

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
						if 'nvaModelConceptId' in node2.tag:
							newEntry['nvaModelConceptId'] = node2.text
						if 'vaModelConceptId' in node2.tag:
							newEntry['vaModelConceptId'] = node2.text
						if 'nvaEditionName' in node2.tag:
							newEntry['nvaEditionName'] = node2.text
						if 'productName' in node2.tag:
							newEntry['productName'] = node2.text
			returnNodes.append(newEntry)
	
	softwareTree = {
		'text':productName,
		'imported':True,
		'source':'pmdm',
		'key':"pmdms"+product,
		'children':[]
	}
	
	# Find all the unique product versions
	for product in returnNodes:
		if not any(x for x in softwareTree['children'] if x['key'] == product['nvaMarketingVersion']):
			softwareTree['children'].append({'text':product['nvaMarketingVersion'],'key':product['nvaMarketingVersion'], 'children':[]})

	# Add editions to versions
	for version in softwareTree['children']:
		for entry in returnNodes:
			if version['key'] == entry['nvaMarketingVersion'] and not any(x for x in version['children'] if x['key'] == entry['nvaModelConceptId']) and not 'Media' in entry['editionType']:
				# Test cases for this: 'LabVIEW', "TestStand" and 'LabVIEW Biomedical Toolkit'
				newName = entry['nvaEditionName'].replace(entry['productName'], '').strip().replace(version['key'],'').strip().replace('  ', ' ').replace(entry['productName'], '').strip()
				if len(newName) == 0:
					newName = entry['editionType']
				version['children'].append({'text':newName,'key':entry['nvaModelConceptId'],'firstAvailable':entry['firstAvailable'], 'children':[]})

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
	xmlNode = pmdmRequest('/Products?%24filter=productType%20eq%20%27Software%27&')
	
	if not 'feed' in xmlNode.tag:
		return "ERROR: Feed tag not found"
	returnNames = []
	
	for child in xmlNode:
		if 'entry' in child.tag:
			newEntry = {}
			for node in child:
				if 'content' in node.tag:
					obj = {'name':'','productId':''}
					for node2 in node[0]:
						if 'name' in node2.tag:
							obj['name'] = node2.text
						if 'productId' in node2.tag:
							obj['productId'] = node2.text
					returnNames.append(obj)
	return json.dumps(returnNames)


@app.route('/pmdmhardwareproducts')
def pmdmhardwareproducts():
	# TODO: Error check the request
	xmlNode = pmdmRequest('/Products?%24filter=productType%20eq%20%27Hardware%27&')
	
	if not 'feed' in xmlNode.tag:
		return "ERROR: Feed tag not found"
	returnNames = []
	
	for child in xmlNode:
		if 'entry' in child.tag:
			newEntry = {}
			for node in child:
				if 'content' in node.tag:
					obj = {'name':'','productId':''}
					for node2 in node[0]:
						if 'name' in node2.tag:
							obj['name'] = node2.text
						if 'productId' in node2.tag:
							obj['productId'] = node2.text
					returnNames.append(obj)
	return json.dumps(returnNames)
	
# USED FOR AZDO DEV, SHOULD NOT BE PUSHED TO PRODUCTION
@app.route('/devSetDoc')
def setDoc():
	doc = request.args.get('doc')
	contents = request.args.get('contents')
	
	doc = re.sub('[\\\\]', '', doc)
	doc = re.sub('[/]', '', doc)
	
	f = open("docs/"+doc, "w+")
	f.write(contents)
	
	return ""
	
# USED FOR AZDO DEV, SHOULD NOT BE PUSHED TO PRODUCTION
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
